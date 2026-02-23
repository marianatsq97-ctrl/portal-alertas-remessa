const tableBody = document.getElementById("tableBody");
const recordsInfo = document.getElementById("recordsInfo");
const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const statusMsg = document.getElementById("statusMsg");
const chartBars = document.getElementById("chartBars");
const chartLabels = document.getElementById("chartLabels");
const monthFilter = document.getElementById("monthFilter");
const yearFilter = document.getElementById("yearFilter");

let rawData = []; // dados NORMALIZADOS

/* ===========================
   HELPERS
=========================== */

function normHeader(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove acentos
}

function pick(row, keys) {
  // tenta achar a coluna por variações (case/acentos)
  const map = {};
  for (const k of Object.keys(row)) map[normHeader(k)] = k;

  for (const key of keys) {
    const found = map[normHeader(key)];
    if (found !== undefined) return row[found];
  }
  return "";
}

function parseDateFlexible(v) {
  if (v === null || v === undefined || v === "") return null;

  // Date
  if (v instanceof Date && !isNaN(v)) return v;

  // Excel serial
  if (typeof v === "number" && isFinite(v)) {
    // Excel epoch -> JS date
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d) ? null : d;
  }

  const s = String(v).trim();
  if (!s) return null;

  // dd/mm/yyyy
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));

  // yyyy-mm-dd ou similar
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function formatDateBR(d) {
  if (!d) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function daysWithoutShipment(dateObj) {
  if (!dateObj) return null;
  const today = new Date();
  const diff = Math.floor((today - dateObj) / 86400000);
  return isFinite(diff) ? diff : null;
}

function statusFromDays(days) {
  if (days === null) return { text: "Sem data", css: "grave" };
  if (days <= 7) return { text: "OK", css: "ok" };
  if (days <= 14) return { text: "Atenção", css: "warn" };
  if (days <= 21) return { text: "Atenção grave", css: "grave" };
  return { text: "Plano de ação", css: "action" };
}

/* ===========================
   NORMALIZAÇÃO (qualquer planilha)
=========================== */

function normalizeRows(rows) {
  // tenta mapear o que vier no XLSX para o formato do portal
  const out = rows.map((row) => {
    const contrato = pick(row, ["Contrato", "Nº Contrato", "Numero Contrato", "C-1001", "contrato"]);
    const cliente  = pick(row, ["Cliente", "CNPJ / Cliente", "CNPJ", "Razão Social", "Razao Social", "cliente"]);
    const obra     = pick(row, ["Nome da obra", "Obra", "nome da obra", "obra"]);
    const volumeRaw = pick(row, ["Volume da obra", "Volume", "Quantidade", "Qtd", "volume", "quantidade"]);
    const dataRaw   = pick(row, ["Última remessa", "Ultima remessa", "Data da remessa", "Data Remessa", "Data", "data"]);

    const volume = Number(String(volumeRaw).replace(",", ".")) || 0;
    const dataObj = parseDateFlexible(dataRaw);

    return {
      cliente: String(cliente || "").trim(),
      contrato: String(contrato || "").trim(),
      obra: String(obra || "").trim(),
      volume,
      dataObj,
      dataTxt: dataObj ? formatDateBR(dataObj) : (String(dataRaw || "").trim() || "-")
    };
  });

  // remove linhas totalmente vazias
  return out.filter(r => r.cliente || r.contrato || r.obra || r.volume || (r.dataTxt && r.dataTxt !== "-"));
}

/* ===========================
   FILTROS
=========================== */

function populateFilters(data) {
  const dates = data.map(d => d.dataObj).filter(Boolean);
  const years = [...new Set(dates.map(d => d.getFullYear()))].sort((a,b)=>a-b);
  const months = [...new Set(dates.map(d => d.getMonth() + 1))].sort((a,b)=>a-b);

  yearFilter.innerHTML =
    `<option value="todos">Ano: todos</option>` +
    years.map(y => `<option value="${y}">Ano: ${y}</option>`).join("");

  monthFilter.innerHTML =
    `<option value="todos">Mês: todos</option>` +
    months.map(m => `<option value="${m}">Mês: ${String(m).padStart(2,"0")}</option>`).join("");
}

function filteredData() {
  const y = yearFilter.value;
  const m = monthFilter.value;

  return rawData.filter(item => {
    // se não tem data:
    // - mostra quando filtros estão "todos"
    // - esconde quando usuário escolheu ano/mês específico
    if (!item.dataObj) return (y === "todos" && m === "todos");

    const yearOk = (y === "todos") || String(item.dataObj.getFullYear()) === y;
    const monthOk = (m === "todos") || String(item.dataObj.getMonth() + 1) === m;
    return yearOk && monthOk;
  });
}

/* ===========================
   RENDER
=========================== */

function updateSummary(data) {
  const count = { ok: 0, warn: 0, grave: 0, action: 0 };

  data.forEach(item => {
    const days = daysWithoutShipment(item.dataObj);
    const st = statusFromDays(days);
    if (count[st.css] !== undefined) count[st.css] += 1;
  });

  document.getElementById("ok").textContent = count.ok;
  document.getElementById("warn").textContent = count.warn;
  document.getElementById("grave").textContent = count.grave;
  document.getElementById("action").textContent = count.action;

  document.getElementById("contratos").textContent =
    new Set(data.map(i => i.contrato).filter(Boolean)).size;

  document.getElementById("clientes").textContent =
    new Set(data.map(i => i.cliente).filter(Boolean)).size;

  document.getElementById("volume").textContent =
    data.reduce((acc, i) => acc + Number(i.volume || 0), 0);
}

function renderChart(data) {
  const grouped = {};
  data.forEach(item => {
    if (!item.dataObj) return;
    const key = `${item.dataObj.getFullYear()}-${String(item.dataObj.getMonth() + 1).padStart(2,"0")}`;
    grouped[key] = (grouped[key] || 0) + Number(item.volume || 0);
  });

  const entries = Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b));
  const max = Math.max(...entries.map(([,v]) => v), 1);

  chartBars.innerHTML = "";
  chartLabels.innerHTML = "";

  entries.forEach(([label, value]) => {
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = `${Math.max(18, (value / max) * 200)}px`;
    bar.title = `${label}: ${value}`;
    chartBars.appendChild(bar);

    const text = document.createElement("span");
    text.textContent = label;
    text.style.width = "48px";
    text.style.textAlign = "center";
    chartLabels.appendChild(text);
  });
}

function renderTable(data) {
  const sorted = [...data].sort((a, b) => {
    const da = daysWithoutShipment(a.dataObj);
    const db = daysWithoutShipment(b.dataObj);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return db - da;
  });

  tableBody.innerHTML = sorted.map(item => {
    const days = daysWithoutShipment(item.dataObj);
    const st = statusFromDays(days);
    const months = (days === null) ? "-" : (days / 30).toFixed(1);

    return `
      <tr>
        <td>${item.cliente || "-"} </td>
        <td>${item.contrato || "-"}</td>
        <td>${item.obra || "-"}</td>
        <td>${item.volume || 0}</td>
        <td>${item.dataTxt || "-"}</td>
        <td>${days === null ? "-" : `${days} dias (${months} meses)`}</td>
        <td><span class="badge ${st.css}">${st.text}</span></td>
      </tr>
    `;
  }).join("");

  recordsInfo.textContent = `Mostrando ${sorted.length} registros • Página 1/1`;
}

function renderAll() {
  const data = filteredData();
  updateSummary(data);
  renderChart(data);
  renderTable(data);
}

/* ===========================
   IMPORTAÇÃO (XLSX/CSV/JSON)
=========================== */

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsText(file);
  });
}

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (!lines.length) return [];
  const headers = lines[0].split(";").map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(";");
    const obj = {};
    headers.forEach((h, i) => obj[h] = (cols[i] ?? "").trim());
    return obj;
  });
}

async function loadSelectedFile() {
  const file = fileInput.files?.[0];
  if (!file) {
    statusMsg.textContent = "Selecione um arquivo antes de carregar.";
    return;
  }

  fileName.textContent = file.name;
  statusMsg.textContent = "Carregando arquivo…";

  const ext = (file.name.split(".").pop() || "").toLowerCase();

  try {
    let rows = [];

    if (ext === "xlsx" || ext === "xls") {
      if (typeof XLSX === "undefined") {
        statusMsg.textContent = "Biblioteca XLSX não carregou. Verifique o index.html.";
        return;
      }
      const buffer = await readAsArrayBuffer(file);
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    } else if (ext === "csv") {
      const txt = await readAsText(file);
      rows = parseCSV(txt);
    } else if (ext === "json") {
      const txt = await readAsText(file);
      rows = JSON.parse(txt);
      if (!Array.isArray(rows)) rows = [];
    } else {
      statusMsg.textContent = "Formato não suportado. Use XLSX/CSV/JSON.";
      return;
    }

    rawData = normalizeRows(rows);
    populateFilters(rawData);

    // garante filtros default = todos
    yearFilter.value = "todos";
    monthFilter.value = "todos";

    renderAll();
    statusMsg.textContent = `Importado com sucesso. Linhas carregadas: ${rawData.length}`;
  } catch (e) {
    console.error(e);
    statusMsg.textContent = "Falha ao importar. Verifique se o arquivo está correto.";
  }
}

/* ===========================
   DEMO (só no botão)
=========================== */

async function loadDemo() {
  try {
    const res = await fetch("data/demo.json", { cache: "no-store" });
    const json = await res.json();
    rawData = normalizeRows(json);
    populateFilters(rawData);
    yearFilter.value = "todos";
    monthFilter.value = "todos";
    renderAll();
    statusMsg.textContent = "Demo carregada (apenas quando você clicou).";
  } catch (e) {
    console.error(e);
    statusMsg.textContent = "Não consegui carregar o demo.json.";
  }
}

function clearData() {
  rawData = [];
  tableBody.innerHTML = "";
  chartBars.innerHTML = "";
  chartLabels.innerHTML = "";
  recordsInfo.textContent = "Mostrando 0 de 0 registros";

  ["ok","warn","grave","action","contratos","clientes","volume"].forEach(id => {
    document.getElementById(id).textContent = "0";
  });

  yearFilter.innerHTML = '<option value="todos">Ano: todos</option>';
  monthFilter.innerHTML = '<option value="todos">Mês: todos</option>';

  statusMsg.textContent = "Dados removidos. Aguardando importação…";
}

/* ===========================
   EVENTOS
=========================== */

document.getElementById("loadFileBtn").addEventListener("click", loadSelectedFile);
document.getElementById("loadDemoBtn").addEventListener("click", loadDemo);
document.getElementById("clearBtn").addEventListener("click", clearData);
document.getElementById("refreshChartBtn").addEventListener("click", renderAll);

fileInput.addEventListener("change", () => {
  fileName.textContent = fileInput.files?.[0]?.name || "Nenhum arquivo selecionado";
});

yearFilter.addEventListener("change", renderAll);
monthFilter.addEventListener("change", renderAll);

/* ✅ IMPORTANTE: NÃO EXISTE loadDemo() AUTOMÁTICO AQUI */
