const STORAGE_KEY = "portal-remessas.v4";
const PAGE_SIZE = 250;

const fileInput = document.getElementById("fileInput");
const btnImport = document.getElementById("btnImport");
const btnLoadDemo = document.getElementById("btnLoadDemo");
const btnClear = document.getElementById("btnClear");
const btnUpdateChart = document.getElementById("btnUpdateChart");
const btnPrevPage = document.getElementById("btnPrevPage");
const btnNextPage = document.getElementById("btnNextPage");

const filterYear = document.getElementById("filterYear");
const filterMonth = document.getElementById("filterMonth");
const toggleMaterial = document.getElementById("toggleMaterial");
const importInfo = document.getElementById("importInfo");
const tableInfo = document.getElementById("tableInfo");

const okCount = document.getElementById("okCount");
const warnCount = document.getElementById("warnCount");
const graveCount = document.getElementById("graveCount");
const actionCount = document.getElementById("actionCount");

const kpiContratos = document.getElementById("kpiContratos");
const kpiClientes = document.getElementById("kpiClientes");
const kpiVolume = document.getElementById("kpiVolume");

const tbody = document.getElementById("tbody");
const chart = document.getElementById("chart");
const thMaterial = document.getElementById("thMaterial");

let raw = readJSON(STORAGE_KEY, []);
let showMaterial = false;
let currentPage = 1;
let currentFiltered = [];

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
}

function safeText(value) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/�+/g, "")
    .trim();
}

function cleanupLegacyStorage() {
  ["portal-remessas.v2", "portal-remessas.v3", "remessas", "dados", "portalData"].forEach((key) => {
    if (key !== STORAGE_KEY) localStorage.removeItem(key);
  });

  if (!Array.isArray(raw)) raw = [];

  const looksCorrupted = raw.some((row) => {
    const text = JSON.stringify(row || {});
    return text.includes("PK\\u0003\\u0004") || text.includes("\uFFFD") || text.length > 25000;
  });

  if (looksCorrupted) {
    raw = [];
    save();
    importInfo.textContent = "Dados locais antigos foram limpos. Importe novamente seu arquivo.";
  }
}

function excelDateToJS(value) {
  if (typeof value !== "number") return null;
  const utcDays = Math.floor(value - 25569);
  return new Date(utcDays * 86400 * 1000);
}

function parseDate(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return value;

  const excelDate = excelDateToJS(value);
  if (excelDate && !Number.isNaN(excelDate.getTime())) return excelDate;

  const s = safeText(value);
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));

  const iso = new Date(s);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function normalizeRow(row) {
  const cnpj = safeText(row.CNPJ || row.cnpj || row["CNPJ CLIENTE"]);
  const cliente = safeText(row.Cliente || row.CLIENTE || row.cliente);
  const contrato = safeText(row.Contrato || row.CONTRATO || row.contrato || "Sem contrato");
  const material = safeText(row.Material || row.MATERIAL || row.material);

  const dataRemessa = parseDate(
    row["Data da remessa"] || row["DATA DA REMESSA"] || row.dataRemessa || row.data || row["Ultima Remessa"] || row["Última remessa"]
  );

  const volume = Number(row["Volume da obra"] || row.volume_obra || row.Volume || row.Quantidade || row["Volume Obra"] || 0) || 0;
  const obra = safeText(row["Nome da obra"] || row.nome_obra || row.Obra || row["Nome Obra"]);

  return {
    cnpj,
    cliente,
    keyCliente: cnpj || cliente || "sem-chave",
    contrato,
    material,
    dataRemessa,
    volume,
    obra,
  };
}

function daysWithout(date) {
  if (!date) return 9999;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function statusByDays(days) {
  if (days <= 7) return { key: "ok", label: "OK" };
  if (days <= 14) return { key: "warn", label: "Atenção" };
  if (days <= 21) return { key: "grave", label: "Atenção grave" };
  return { key: "action", label: "Plano de ação" };
}

function prettyAge(days) {
  if (days > 365) return `${days} dias (${(days / 365).toFixed(1)} anos)`;
  if (days > 31) return `${days} dias (${(days / 30).toFixed(1)} meses)`;
  return `${days} dias`;
}

function aggregate(rows) {
  const map = new Map();

  rows.map(normalizeRow).forEach((r) => {
    const key = `${r.keyCliente}::${r.contrato}`;
    const prev = map.get(key);

    if (!prev) {
      map.set(key, {
        key,
        cnpj: r.cnpj,
        cliente: r.cliente,
        contrato: r.contrato,
        obra: r.obra,
        volume: r.volume,
        lastDate: r.dataRemessa,
        materials: r.material ? [r.material] : [],
      });
      return;
    }

    prev.volume += r.volume;
    if (r.obra && !prev.obra) prev.obra = r.obra;
    if (!prev.lastDate || (r.dataRemessa && r.dataRemessa > prev.lastDate)) prev.lastDate = r.dataRemessa;
    if (r.material && !prev.materials.includes(r.material)) prev.materials.push(r.material);
  });

  return [...map.values()].map((item) => {
    const days = daysWithout(item.lastDate);
    return { ...item, days, status: statusByDays(days) };
  });
}

function initFilters(items) {
  const years = [...new Set(items.map((i) => (i.lastDate ? i.lastDate.getFullYear() : null)).filter(Boolean))].sort((a, b) => b - a);
  filterYear.innerHTML = '<option value="all">Todos</option>' + years.map((y) => `<option value="${y}">${y}</option>`).join("");

  const months = ["Todos", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  filterMonth.innerHTML = months.map((m, i) => `<option value="${i - 1}">${m}</option>`).join("");
}

function filtered(items) {
  const y = filterYear.value;
  const m = Number(filterMonth.value);

  return items.filter((item) => {
    if (!item.lastDate) return y === "all" && m === -1;
    return (y === "all" || item.lastDate.getFullYear() === Number(y)) && (m === -1 || item.lastDate.getMonth() === m);
  });
}

function renderSummary(items) {
  const counts = { ok: 0, warn: 0, grave: 0, action: 0 };
  items.forEach((i) => counts[i.status.key]++);

  okCount.textContent = counts.ok;
  warnCount.textContent = counts.warn;
  graveCount.textContent = counts.grave;
  actionCount.textContent = counts.action;

  kpiContratos.textContent = items.length;
  kpiClientes.textContent = new Set(items.map((i) => i.cnpj || i.cliente)).size;
  kpiVolume.textContent = items.reduce((acc, i) => acc + i.volume, 0).toLocaleString("pt-BR");
}

function renderTable(items) {
  thMaterial.style.display = showMaterial ? "table-cell" : "none";

  const sorted = [...items].sort((a, b) => b.days - a.days);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = pageItems
    .map((item) => {
      const displayClient = item.cnpj ? `${item.cnpj} • ${item.cliente || "Sem nome"}` : item.cliente || "Sem nome";
      return `
        <tr>
          <td>${displayClient}</td>
          <td>${item.contrato}</td>
          <td>${item.obra || "-"}</td>
          <td>${item.volume.toLocaleString("pt-BR")}</td>
          <td>${item.lastDate ? item.lastDate.toLocaleDateString("pt-BR") : "Sem data"}</td>
          <td>${prettyAge(item.days)}</td>
          <td><span class="badge ${item.status.key}">${item.status.label}</span></td>
          ${showMaterial ? `<td>${item.materials.join(", ") || "-"}</td>` : ""}
        </tr>
      `;
    })
    .join("");

  tableInfo.textContent = `Mostrando ${pageItems.length} de ${sorted.length} registros • Página ${currentPage}/${totalPages}`;
  btnPrevPage.disabled = currentPage <= 1;
  btnNextPage.disabled = currentPage >= totalPages;
}

function monthSeries(rows) {
  const agg = {};
  rows.map(normalizeRow).forEach((r) => {
    if (!r.dataRemessa) return;
    const key = `${r.dataRemessa.getFullYear()}-${String(r.dataRemessa.getMonth() + 1).padStart(2, "0")}`;
    if (!agg[key]) agg[key] = { ok: 0, warn: 0, grave: 0, action: 0 };
    agg[key][statusByDays(daysWithout(r.dataRemessa)).key] += 1;
  });

  return Object.entries(agg)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([label, data]) => ({ label, ...data }));
}

function drawChart(rows) {
  const ctx = chart.getContext("2d");
  const w = chart.width;
  const h = chart.height;
  ctx.clearRect(0, 0, w, h);

  const series = monthSeries(rows);
  if (!series.length) {
    ctx.fillStyle = "#a6b0d6";
    ctx.font = "16px sans-serif";
    ctx.fillText("Sem dados para o gráfico", 20, 40);
    return;
  }

  const max = Math.max(...series.map((s) => s.ok + s.warn + s.grave + s.action), 1);
  const slot = (w - 80) / series.length;
  const barW = Math.max(32, slot - 12);

  series.forEach((s, idx) => {
    const x = 50 + idx * slot;
    let y = h - 40;
    [["ok", "#39d98a"], ["warn", "#ffd84d"], ["grave", "#ff9f43"], ["action", "#ff5b6e"]].forEach(([k, color]) => {
      const value = s[k];
      if (!value) return;
      const bh = ((h - 90) * value) / max;
      y -= bh;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barW, bh);
    });

    ctx.fillStyle = "#a6b0d6";
    ctx.font = "12px sans-serif";
    ctx.fillText(s.label, x, h - 16);
  });
}

function getRawByCurrentFilters() {
  return raw.filter((r) => {
    const d = parseDate(r["Data da remessa"] || r["DATA DA REMESSA"] || r.dataRemessa || r.data || r["Ultima Remessa"] || r["Última remessa"]);
    if (!d) return false;
    const y = filterYear.value;
    const m = Number(filterMonth.value);
    return (y === "all" || d.getFullYear() === Number(y)) && (m === -1 || d.getMonth() === m);
  });
}

function refresh() {
  const items = aggregate(raw);
  if (!filterYear.options.length) initFilters(items);
  currentFiltered = filtered(items);
  renderSummary(currentFiltered);
  renderTable(currentFiltered);
  drawChart(getRawByCurrentFilters());
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const cols = line.split(sep);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = safeText(cols[i]);
    });
    return obj;
  });
}

async function parseSpreadsheet(file) {
  const ext = file.name.toLowerCase().split(".").pop();

  if (ext === "csv") return parseCSV(await file.text());
  if (ext === "json") return JSON.parse(await file.text());

  if (ext === "xlsx" || ext === "xls") {
    if (!window.XLSX) throw new Error("Biblioteca XLSX não carregada.");

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: "" });
  }

  throw new Error("Formato não suportado.");
}

btnLoadDemo.addEventListener("click", async () => {
  const res = await fetch("data/demo.json");
  raw = await res.json();
  save();
  filterYear.innerHTML = "";
  currentPage = 1;
  importInfo.textContent = "Demo carregada com sucesso.";
  refresh();
});

btnImport.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) return alert("Selecione um arquivo CSV, JSON ou XLSX.");

  try {
    raw = await parseSpreadsheet(file);
    save();
    filterYear.innerHTML = "";
    currentPage = 1;
    importInfo.textContent = `Arquivo carregado: ${file.name} (${raw.length} linhas)`;
    refresh();
  } catch {
    importInfo.textContent = "Falha ao importar. Verifique se escolheu XLSX/CSV/JSON válido.";
    alert("Não foi possível importar o arquivo.");
  }
});

btnClear.addEventListener("click", () => {
  raw = [];
  save();
  filterYear.innerHTML = "";
  currentPage = 1;
  importInfo.textContent = "Dados excluídos.";
  refresh();
});

btnPrevPage.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    renderTable(currentFiltered);
  }
});

btnNextPage.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(currentFiltered.length / PAGE_SIZE));
  if (currentPage < totalPages) {
    currentPage += 1;
    renderTable(currentFiltered);
  }
});

filterYear.addEventListener("change", () => {
  currentPage = 1;
  refresh();
});

filterMonth.addEventListener("change", () => {
  currentPage = 1;
  refresh();
});

btnUpdateChart.addEventListener("click", refresh);

toggleMaterial.addEventListener("change", (e) => {
  showMaterial = e.target.checked;
  renderTable(currentFiltered);
});

cleanupLegacyStorage();
refresh();
