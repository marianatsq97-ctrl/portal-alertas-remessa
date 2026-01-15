/* Portal de Alertas – Remessas (estático / GitHub Pages)
   - Importa XLSX/CSV no browser
   - Consolida por (cliente+contrato+vendedor+traco+material) pegando a última remessa e somando quantidades
   - Calcula dias sem remessa e status
   - Salva dados no localStorage (não some ao dar refresh)
   - Tabela com filtros no cabeçalho (dropdown por coluna)
   - KPIs clicáveis (abre histórico por status)
   - Gráfico (mês/ano) com cores por status (stacked)
*/

const STORAGE_KEY = "portalAlertasRemessas:v1";

/* ====== Regras de status ====== */
const STATUS = {
  OK: { key: "OK", label: "OK", color: "#2bd67b" },          // 0–4
  ATENCAO: { key: "ATENCAO", label: "Atenção", color: "#f2c94c" }, // 5–7
  PLANO: { key: "PLANO", label: "Plano de ação", color: "#ff4d4d" } // >7
};

function calcStatus(days) {
  if (!Number.isFinite(days)) return STATUS.PLANO.key;
  if (days <= 4) return STATUS.OK.key;
  if (days <= 7) return STATUS.ATENCAO.key;
  return STATUS.PLANO.key;
}

/* ====== Estado ====== */
let baseRows = [];      // consolidado
let shownRows = [];     // filtrado
let sourceMeta = { name: "—", importedAt: null, rawCount: 0, consolidatedCount: 0 };

let filterState = {
  quickStatus: "",  // OK/ATENCAO/PLANO
  minDate: "",      // yyyy-mm-dd
  col: {
    cliente: null,
    contrato: null,
    vendedor: null,
    traco: null,
    material: null,
    ultimaRemessa: null, // string dd/mm/aaaa
    quantidade: null,
    diasSem: null,
    status: null
  }
};

let chart = null;

/* ====== Elementos ====== */
const elHome = document.getElementById("homeCard");

const sectionViz = document.getElementById("sectionViz");
const sectionData = document.getElementById("sectionData");

const btnGoViz = document.getElementById("btnGoViz");
const btnGoData = document.getElementById("btnGoData");
const btnGoAll = document.getElementById("btnGoAll");

const btnBackFromViz = document.getElementById("btnBackFromViz");
const btnBackFromData = document.getElementById("btnBackFromData");

const fileInput = document.getElementById("fileInput");
const importFileName = document.getElementById("importFileName");
const importInfo = document.getElementById("importInfo");
const btnLoadDemo = document.getElementById("btnLoadDemo");
const btnClearData = document.getElementById("btnClearData");

const statusQuick = document.getElementById("statusQuick");
const minDateQuick = document.getElementById("minDateQuick");
const btnClearFilters = document.getElementById("btnClearFilters");
const recordsShown = document.getElementById("recordsShown");

const tableBody = document.getElementById("tableBody");

const kpiOKValue = document.getElementById("kpiOKValue");
const kpiWARNValue = document.getElementById("kpiWARNValue");
const kpiDANGERValue = document.getElementById("kpiDANGERValue");
const kpiOK = document.getElementById("kpiOK");
const kpiWARN = document.getElementById("kpiWARN");
const kpiDANGER = document.getElementById("kpiDANGER");

const filterYear = document.getElementById("filterYear");
const filterMonth = document.getElementById("filterMonth");
const btnRefreshChart = document.getElementById("btnRefreshChart");

const sourceNameEl = document.getElementById("sourceName");
const sourceCountEl = document.getElementById("sourceCount");
const shownCountEl = document.getElementById("shownCount");
const sourceInfo = document.getElementById("sourceInfo");

const filterPopup = document.getElementById("filterPopup");
const filterPopupTitle = document.getElementById("filterPopupTitle");
const filterPopupClose = document.getElementById("filterPopupClose");
const filterSearch = document.getElementById("filterSearch");
const filterList = document.getElementById("filterList");
const filterSelectAll = document.getElementById("filterSelectAll");
const filterClear = document.getElementById("filterClear");
const filterApply = document.getElementById("filterApply");

const modalOverlay = document.getElementById("modalOverlay");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalSub = document.getElementById("modalSub");
const modalClose = document.getElementById("modalClose");
const modalSearch = document.getElementById("modalSearch");
const modalBodyRows = document.getElementById("modalBodyRows");
const btnExportModalCSV = document.getElementById("btnExportModalCSV");
const btnGoToDataFromModal = document.getElementById("btnGoToDataFromModal");

/* ====== Navegação ====== */
btnGoViz.addEventListener("click", () => showOnly("viz"));
btnGoData.addEventListener("click", () => showOnly("data"));
btnGoAll.addEventListener("click", () => showOnly("all"));

btnBackFromViz.addEventListener("click", () => showOnly("home"));
btnBackFromData.addEventListener("click", () => showOnly("home"));

function showOnly(mode) {
  // home sempre visível no topo, mas seções controladas
  if (mode === "home") {
    sectionViz.classList.add("hidden");
    sectionData.classList.add("hidden");
    elHome.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (mode === "viz") {
    sectionViz.classList.remove("hidden");
    sectionData.classList.add("hidden");
    sectionViz.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (mode === "data") {
    sectionData.classList.remove("hidden");
    sectionViz.classList.add("hidden");
    sectionData.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  // all: mostra as duas seções (visual + dados) e rola
  sectionViz.classList.remove("hidden");
  sectionData.classList.remove("hidden");
  sectionViz.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ====== Util: normalização de cabeçalho ====== */
function normKey(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pick(obj, aliases) {
  // tenta achar uma key por alias normalizado
  const keys = Object.keys(obj || {});
  const map = new Map(keys.map(k => [normKey(k), k]));

  for (const al of aliases) {
    const nk = normKey(al);
    if (map.has(nk)) return obj[map.get(nk)];
  }

  // fallback: tentativa por "includes"
  for (const al of aliases) {
    const nk = normKey(al);
    for (const [kNorm, kRaw] of map.entries()) {
      if (kNorm.includes(nk) || nk.includes(kNorm)) return obj[kRaw];
    }
  }

  return undefined;
}

/* ====== Datas ====== */
function parseDateAny(v) {
  // aceita:
  // - Date
  // - número excel
  // - string dd/mm/aaaa, yyyy-mm-dd, etc.
  if (!v && v !== 0) return null;

  if (v instanceof Date && !isNaN(v)) return v;

  if (typeof v === "number") {
    // Excel serial date
    const utc_days = Math.floor(v - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    // correção de fuso
    const frac = v - Math.floor(v);
    const total_seconds = Math.round(86400 * frac);
    return new Date(date_info.getTime() + total_seconds * 1000);
  }

  const s = String(v).trim();
  if (!s) return null;

  // dd/mm/aaaa
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) {
    const dd = Number(m1[1]);
    const mm = Number(m1[2]) - 1;
    const yy = Number(m1[3]);
    const d = new Date(yy, mm, dd);
    return isNaN(d) ? null : d;
  }

  // yyyy-mm-dd
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) {
    const yy = Number(m2[1]);
    const mm = Number(m2[2]) - 1;
    const dd = Number(m2[3]);
    const d = new Date(yy, mm, dd);
    return isNaN(d) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function formatBR(d) {
  if (!d || isNaN(d)) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function monthYearLabel(d) {
  // "MM/YYYY"
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${mm}/${d.getFullYear()}`;
}

function daysBetween(fromDate, toDate) {
  const ms = toDate.getTime() - fromDate.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/* ====== Importação ====== */
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  await loadFromFile(file);
});

btnLoadDemo.addEventListener("click", async () => {
  try {
    const res = await fetch("./data/demo.json", { cache: "no-store" });
    const demo = await res.json();
    loadFromJsonRows(demo, { name: "demo.json" });
    showOnly("all");
  } catch (err) {
    alert("Não consegui carregar o demo.json. Confere se está em /data/demo.json.");
    console.error(err);
  }
});

btnClearData.addEventListener("click", () => {
  if (!confirm("Quer excluir o arquivo/dados salvos e zerar o portal?")) return;
  clearAllData();
});

async function loadFromFile(file) {
  const name = file.name || "arquivo";

  // UI “carregando”
  importFileName.textContent = name;
  importInfo.textContent = "Lendo arquivo...";

  const ext = name.toLowerCase().split(".").pop();

  try {
    if (ext === "csv") {
      const text = await file.text();
      const rows = csvToJson(text);
      loadFromJsonRows(rows, { name });
      return;
    }

    // XLSX/XLS
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const firstSheet = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheet];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

    loadFromJsonRows(rows, { name });
  } catch (err) {
    console.error(err);
    alert("Erro ao ler arquivo. Se for XLSX, tenta salvar de novo no Excel e importar novamente.");
    importInfo.textContent = "Erro ao ler arquivo.";
  }
}

function csvToJson(text) {
  // CSV simples (separador , ou ;)
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.trim());

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep);
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (cols[idx] ?? "").trim());
    out.push(obj);
  }
  return out;
}

function loadFromJsonRows(rawRows, meta) {
  const importedAt = new Date();
  sourceMeta = {
    name: meta?.name || "arquivo",
    importedAt,
    rawCount: rawRows.length,
    consolidatedCount: 0
  };

  const consolidated = consolidate(rawRows);
  baseRows = consolidated;
  sourceMeta.consolidatedCount = consolidated.length;

  persist();

  updateImportUI();
  refreshAll();
}

function consolidate(rawRows) {
  // Mapeia colunas flexível (aceita nomes parecidos)
  const today = new Date();

  const mapRow = (r) => {
    const cliente = pick(r, ["Cliente", "Nome do Cliente", "Razão social", "Razao social", "Cliente (nome)"]);
    const contrato = pick(r, ["Contrato", "Nº Contrato", "Numero Contrato", "Cód Contrato", "Cod Contrato"]);
    const vendedor = pick(r, ["Vendedor", "Representante", "Comercial", "Atendente"]);
    const traco = pick(r, ["Traço", "Traco", "Traço/Traço", "Traço (Concreto)", "Traco (Concreto)"]);
    const material = pick(r, ["Material", "Produto", "Material/Produto", "Descricao", "Descrição"]);
    const quantidade = pick(r, ["Quantidade", "Qtde", "Qtd", "Volume", "M3", "m3"]);
    const dataRemessa = pick(r, ["Data da remessa", "Data Remessa", "Data", "Data de remessa", "Dt remessa", "Data emissão", "Data emissao"]);

    const d = parseDateAny(dataRemessa);

    const qNum = parseNumberAny(quantidade);

    return {
      cliente: String(cliente ?? "").trim(),
      contrato: String(contrato ?? "").trim(),
      vendedor: String(vendedor ?? "").trim(),
      traco: String(traco ?? "").trim(),
      material: String(material ?? "").trim(),
      dataRemessa: d,
      quantidade: Number.isFinite(qNum) ? qNum : null,
      _today: today
    };
  };

  const mapped = rawRows.map(mapRow).filter(x => x.cliente);

  // Consolida por chave
  const byKey = new Map();
  for (const r of mapped) {
    const key = [
      r.cliente || "",
      r.contrato || "",
      r.vendedor || "",
      r.traco || "",
      r.material || ""
    ].join("||");

    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...r, sumQ: r.quantidade ?? 0, last: r.dataRemessa });
      continue;
    }

    // soma quantidade
    prev.sumQ += (r.quantidade ?? 0);

    // última remessa = max data
    if (r.dataRemessa && (!prev.last || r.dataRemessa > prev.last)) {
      prev.last = r.dataRemessa;
    }
  }

  const out = [];
  for (const v of byKey.values()) {
    const last = v.last;
    const days = last ? daysBetween(last, v._today) : NaN;
    const status = calcStatus(days);

    out.push({
      cliente: v.cliente,
      contrato: v.contrato,
      vendedor: v.vendedor,
      traco: v.traco,
      material: v.material,
      ultimaRemessa: last ? formatBR(last) : "",
      ultimaRemessaDate: last,
      quantidade: Number.isFinite(v.sumQ) ? v.sumQ : null,
      diasSem: Number.isFinite(days) ? days : null,
      status
    });
  }

  // ordena: pior primeiro
  out.sort((a, b) => (b.diasSem ?? -1) - (a.diasSem ?? -1));
  return out;
}

function parseNumberAny(v) {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (!s) return NaN;

  // "3.222" e "478,5" etc
  // remove espaços e troca vírgula por ponto quando necessário
  // regra: se tem vírgula e NÃO tem ponto decimal, assume vírgula decimal
  let t = s.replace(/\s+/g, "");

  // se tem mais de um ponto e nenhuma vírgula: pode ser milhar
  // se tem vírgula: trata como decimal
  if (t.includes(",") && !t.includes(".")) {
    t = t.replace(",", ".");
  } else if (t.includes(",") && t.includes(".")) {
    // 1.234,56 -> 1234.56
    t = t.replace(/\./g, "").replace(",", ".");
  }

  // tira qualquer coisa não numérica (exceto . e -)
  t = t.replace(/[^0-9.-]/g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/* ====== Persistência ====== */
function persist() {
  const payload = {
    meta: {
      name: sourceMeta.name,
      importedAt: sourceMeta.importedAt ? sourceMeta.importedAt.toISOString() : null,
      rawCount: sourceMeta.rawCount,
      consolidatedCount: sourceMeta.consolidatedCount
    },
    rows: baseRows.map(r => ({
      ...r,
      ultimaRemessaDate: r.ultimaRemessaDate ? r.ultimaRemessaDate.toISOString() : null
    }))
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function restore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  try {
    const payload = JSON.parse(raw);
    const meta = payload?.meta || {};
    sourceMeta = {
      name: meta.name || "—",
      importedAt: meta.importedAt ? new Date(meta.importedAt) : null,
      rawCount: meta.rawCount || 0,
      consolidatedCount: meta.consolidatedCount || 0
    };

    baseRows = (payload?.rows || []).map(r => ({
      ...r,
      ultimaRemessaDate: r.ultimaRemessaDate ? new Date(r.ultimaRemessaDate) : null
    }));

    updateImportUI();
    refreshAll();
    return true;
  } catch {
    return false;
  }
}

function clearAllData() {
  localStorage.removeItem(STORAGE_KEY);
  baseRows = [];
  shownRows = [];
  sourceMeta = { name: "—", importedAt: null, rawCount: 0, consolidatedCount: 0 };

  // reset filtros
  filterState.quickStatus = "";
  filterState.minDate = "";
  for (const k of Object.keys(filterState.col)) filterState.col[k] = null;

  // reset UI
  fileInput.value = "";
  statusQuick.value = "";
  minDateQuick.value = "";

  updateImportUI();
  refreshAll();
}

/* ====== UI import ====== */
function updateImportUI() {
  const name = sourceMeta.name || "—";
  importFileName.textContent = name;

  if (!baseRows.length) {
    importInfo.textContent = "Nenhum dado carregado.";
    sourceNameEl.textContent = "—";
    sourceCountEl.textContent = "0";
    shownCountEl.textContent = "0";
    return;
  }

  const dt = sourceMeta.importedAt ? sourceMeta.importedAt.toLocaleString("pt-BR") : "—";
  importInfo.textContent = `Carregado em: ${dt} • linhas: ${sourceMeta.rawCount} • Consolidado: ${sourceMeta.consolidatedCount}`;

  sourceNameEl.textContent = name;
  sourceCountEl.textContent = String(sourceMeta.consolidatedCount);
}

/* ====== Filtros (quick) ====== */
statusQuick.addEventListener("change", () => {
  filterState.quickStatus = statusQuick.value;
  refreshAll();
});

minDateQuick.addEventListener("change", () => {
  filterState.minDate = minDateQuick.value; // yyyy-mm-dd
  refreshAll();
});

btnClearFilters.addEventListener("click", () => {
  filterState.quickStatus = "";
  filterState.minDate = "";
  for (const k of Object.keys(filterState.col)) filterState.col[k] = null;

  statusQuick.value = "";
  minDateQuick.value = "";
  refreshAll();
});

/* ====== Filtro por coluna (popup) ====== */
let popupCol = null;
let popupTmpSet = new Set();

document.querySelectorAll(".filterBtn").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const col = btn.dataset.col;
    openFilterPopup(col);
  });
});

filterPopupClose.addEventListener("click", closeFilterPopup);
document.addEventListener("click", (e) => {
  // fecha se clicar fora
  if (!filterPopup.classList.contains("hidden")) {
    const inside = filterPopup.contains(e.target);
    if (!inside) closeFilterPopup();
  }
});

filterSearch.addEventListener("input", () => {
  renderPopupList();
});

filterSelectAll.addEventListener("click", () => {
  const values = getUniqueValuesForCol(popupCol);
  popupTmpSet = new Set(values);
  renderPopupList();
});

filterClear.addEventListener("click", () => {
  popupTmpSet = new Set();
  renderPopupList();
});

filterApply.addEventListener("click", () => {
  filterState.col[popupCol] = popupTmpSet.size ? new Set([...popupTmpSet]) : null;
  closeFilterPopup();
  refreshAll();
});

function openFilterPopup(col) {
  popupCol = col;

  // carregar seleção atual
  const current = filterState.col[col];
  popupTmpSet = current ? new Set([...current]) : new Set();

  filterPopupTitle.textContent = `Filtro: ${colToLabel(col)}`;
  filterSearch.value = "";

  renderPopupList();
  filterPopup.classList.remove("hidden");
}

function closeFilterPopup() {
  filterPopup.classList.add("hidden");
  popupCol = null;
  popupTmpSet = new Set();
}

function colToLabel(col) {
  const map = {
    cliente: "Cliente",
    contrato: "Contrato",
    vendedor: "Vendedor",
    traco: "Traço",
    material: "Material",
    ultimaRemessa: "Última remessa",
    quantidade: "Quantidade",
    diasSem: "Dias sem remessa",
    status: "Status"
  };
  return map[col] || col;
}

function getUniqueValuesForCol(col) {
  const vals = new Set();

  for (const r of baseRows) {
    let v = "";

    if (col === "cliente") v = r.cliente;
    else if (col === "contrato") v = r.contrato;
    else if (col === "vendedor") v = r.vendedor;
    else if (col === "traco") v = r.traco;
    else if (col === "material") v = r.material;
    else if (col === "ultimaRemessa") v = r.ultimaRemessa || "";
    else if (col === "quantidade") v = r.quantidade != null ? String(r.quantidade) : "";
    else if (col === "diasSem") v = r.diasSem != null ? String(r.diasSem) : "";
    else if (col === "status") v = r.status;

    v = String(v ?? "").trim();
    if (v) vals.add(v);
  }

  return [...vals].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
}

function renderPopupList() {
  const values = getUniqueValuesForCol(popupCol);
  const q = filterSearch.value.trim().toLowerCase();

  filterList.innerHTML = "";

  const filtered = q
    ? values.filter(v => v.toLowerCase().includes(q))
    : values;

  if (!filtered.length) {
    const div = document.createElement("div");
    div.className = "filterItem";
    div.innerHTML = `<span style="color:rgba(255,255,255,.65)">Nada encontrado.</span>`;
    filterList.appendChild(div);
    return;
  }

  for (const v of filtered) {
    const id = `chk_${popupCol}_${v.replace(/[^a-z0-9]/gi, "_")}`;

    const div = document.createElement("div");
    div.className = "filterItem";

    const checked = popupTmpSet.has(v);

    div.innerHTML = `
      <input type="checkbox" id="${id}" ${checked ? "checked" : ""}/>
      <label for="${id}">${escapeHtml(v)}</label>
    `;

    const cb = div.querySelector("input");
    cb.addEventListener("change", () => {
      if (cb.checked) popupTmpSet.add(v);
      else popupTmpSet.delete(v);
    });

    filterList.appendChild(div);
  }
}

/* ====== Apply filters ====== */
function applyFilters(rows) {
  let out = rows.slice();

  // quick status
  if (filterState.quickStatus) {
    out = out.filter(r => r.status === filterState.quickStatus);
  }

  // min date
  if (filterState.minDate) {
    const dMin = parseDateAny(filterState.minDate);
    if (dMin) {
      out = out.filter(r => r.ultimaRemessaDate && r.ultimaRemessaDate >= dMin);
    }
  }

  // column sets
  for (const [col, set] of Object.entries(filterState.col)) {
    if (!set || set.size === 0) continue;

    out = out.filter(r => {
      let v = "";
      if (col === "cliente") v = r.cliente;
      else if (col === "contrato") v = r.contrato;
      else if (col === "vendedor") v = r.vendedor;
      else if (col === "traco") v = r.traco;
      else if (col === "material") v = r.material;
      else if (col === "ultimaRemessa") v = r.ultimaRemessa || "";
      else if (col === "quantidade") v = r.quantidade != null ? String(r.quantidade) : "";
      else if (col === "diasSem") v = r.diasSem != null ? String(r.diasSem) : "";
      else if (col === "status") v = r.status;
      v = String(v ?? "").trim();
      return set.has(v);
    });
  }

  return out;
}

/* ====== Render Tabela ====== */
function renderTable(rows) {
  tableBody.innerHTML = "";

  if (!rows.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" style="color:rgba(255,255,255,.65); padding:18px">
          Nenhum registro para exibir. (Importe um arquivo ou ajuste os filtros.)
        </td>
      </tr>
    `;
    return;
  }

  for (const r of rows) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHtml(r.cliente)}</td>
      <td>${escapeHtml(r.contrato || "-")}</td>
      <td>${escapeHtml(r.vendedor || "-")}</td>
      <td>${escapeHtml(r.traco || "-")}</td>
      <td>${escapeHtml(r.material || "-")}</td>
      <td>${escapeHtml(r.ultimaRemessa || "-")}</td>
      <td>${formatQty(r.quantidade)}</td>
      <td>${r.diasSem != null ? escapeHtml(String(r.diasSem)) : "-"}</td>
      <td>${renderStatusPill(r.status)}</td>
    `;

    // status clicável
    const pill = tr.querySelector(".statusPill");
    if (pill) {
      pill.addEventListener("click", () => openHistoryModal(r.status));
    }

    tableBody.appendChild(tr);
  }
}

function formatQty(q) {
  if (q === null || q === undefined || !Number.isFinite(q)) return "-";
  // pt-BR com vírgula
  return q.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function renderStatusPill(statusKey) {
  const s = STATUS[statusKey] || STATUS.PLANO;
  const cls = statusKey === STATUS.OK.key ? "statusOK"
            : statusKey === STATUS.ATENCAO.key ? "statusWARN"
            : "statusDANGER";

  return `
    <span class="statusPill ${cls}" data-status="${escapeHtml(statusKey)}">
      <span class="dot"></span>
      ${escapeHtml(s.label)}
    </span>
  `;
}

/* ====== KPIs + Chart ====== */
function updateKPIs(rows) {
  const ok = rows.filter(r => r.status === STATUS.OK.key).length;
  const warn = rows.filter(r => r.status === STATUS.ATENCAO.key).length;
  const danger = rows.filter(r => r.status === STATUS.PLANO.key).length;

  kpiOKValue.textContent = String(ok);
  kpiWARNValue.textContent = String(warn);
  kpiDANGERValue.textContent = String(danger);

  // KPIs clicáveis (histórico completo)
  kpiOK.onclick = () => openHistoryModal(STATUS.OK.key);
  kpiWARN.onclick = () => openHistoryModal(STATUS.ATENCAO.key);
  kpiDANGER.onclick = () => openHistoryModal(STATUS.PLANO.key);
}

function buildEvolution(rows) {
  // Agrupa por mês/ano da última remessa (MM/YYYY)
  // e separa por status (stacked)
  const map = new Map(); // label -> {ok,warn,danger}

  for (const r of rows) {
    if (!r.ultimaRemessaDate || isNaN(r.ultimaRemessaDate)) continue;
    const label = monthYearLabel(r.ultimaRemessaDate);

    if (!map.has(label)) {
      map.set(label, { ok: 0, warn: 0, danger: 0, date: new Date(r.ultimaRemessaDate.getFullYear(), r.ultimaRemessaDate.getMonth(), 1) });
    }
    const v = map.get(label);

    if (r.status === STATUS.OK.key) v.ok++;
    else if (r.status === STATUS.ATENCAO.key) v.warn++;
    else v.danger++;
  }

  const items = [...map.entries()]
    .map(([label, obj]) => ({ label, ...obj }))
    .sort((a, b) => a.date - b.date);

  return items;
}

function ensureYearMonthOptions(rows) {
  const evo = buildEvolution(rows);

  const years = new Set();
  const months = new Set(); // 1-12
  for (const it of evo) {
    years.add(it.date.getFullYear());
    months.add(it.date.getMonth() + 1);
  }

  const yearArr = [...years].sort((a, b) => b - a);
  const monthArr = [...months].sort((a, b) => a - b);

  // Ano
  filterYear.innerHTML = "";
  for (const y of yearArr.length ? yearArr : [new Date().getFullYear()]) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    filterYear.appendChild(opt);
  }

  // Mês
  filterMonth.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "Todos";
  filterMonth.appendChild(optAll);

  for (const m of monthArr.length ? monthArr : [new Date().getMonth() + 1]) {
    const opt = document.createElement("option");
    opt.value = String(m);
    opt.textContent = String(m).padStart(2, "0");
    filterMonth.appendChild(opt);
  }
}

function renderChart(rows) {
  const evoAll = buildEvolution(rows);

  const y = Number(filterYear.value || new Date().getFullYear());
  const m = filterMonth.value ? Number(filterMonth.value) : null;

  const evo = evoAll.filter(it => {
    if (it.date.getFullYear() !== y) return false;
    if (m && (it.date.getMonth() + 1) !== m) return false;
    return true;
  });

  const labels = evo.map(it => it.label); // MM/YYYY (sem data completa)
  const dsOK = evo.map(it => it.ok);
  const dsWARN = evo.map(it => it.warn);
  const dsDANGER = evo.map(it => it.danger);

  const ctx = document.getElementById("chartEvolution");

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = dsOK;
    chart.data.datasets[1].data = dsWARN;
    chart.data.datasets[2].data = dsDANGER;
    chart.update();
    return;
  }

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "OK",
          data: dsOK,
          backgroundColor: STATUS.OK.color,
          borderRadius: 6
        },
        {
          label: "Atenção",
          data: dsWARN,
          backgroundColor: STATUS.ATENCAO.color,
          borderRadius: 6
        },
        {
          label: "Plano de ação",
          data: dsDANGER,
          backgroundColor: STATUS.PLANO.color,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: { color: "rgba(255,255,255,.8)", font: { weight: "700" } }
        },
        tooltip: {
          callbacks: {
            title: (items) => items?.[0]?.label || ""
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: "rgba(255,255,255,.75)",
            maxRotation: 0,
            autoSkip: true
          },
          grid: { color: "rgba(255,255,255,.06)" }
        },
        y: {
          stacked: true,
          ticks: { color: "rgba(255,255,255,.75)" },
          grid: { color: "rgba(255,255,255,.06)" }
        }
      }
    }
  });

  // deixa a área do canvas com altura fixa melhor
  ctx.parentElement.style.height = "360px";
}

btnRefreshChart.addEventListener("click", () => {
  renderChart(shownRows);
});

/* ====== Modal Histórico ====== */
let modalRows = [];

function openHistoryModal(statusKey) {
  const label = STATUS[statusKey]?.label || statusKey;

  // pega o que está sendo exibido (já filtrado) e filtra só pelo status clicado
  const rows = shownRows.filter(r => r.status === statusKey);

  modalRows = rows;

  modalTitle.textContent = `Histórico • ${label}`;
  modalSub.textContent = `${rows.length} registros (base atual filtrada)`;

  modalSearch.value = "";
  renderModalRows(rows);

  modalOverlay.classList.remove("hidden");
  modal.classList.remove("hidden");
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  modal.classList.add("hidden");
  modalRows = [];
}

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", closeModal);

modalSearch.addEventListener("input", () => {
  const q = modalSearch.value.trim().toLowerCase();
  if (!q) return renderModalRows(modalRows);

  const filtered = modalRows.filter(r => {
    const blob = [
      r.cliente, r.contrato, r.vendedor, r.traco, r.material,
      r.ultimaRemessa, String(r.quantidade ?? ""), String(r.diasSem ?? ""), r.status
    ].join(" ").toLowerCase();
    return blob.includes(q);
  });

  renderModalRows(filtered);
});

btnExportModalCSV.addEventListener("click", () => {
  if (!modalRows.length) return;

  const headers = ["Cliente","Contrato","Vendedor","Traço","Material","Última remessa","Quantidade","Dias sem remessa","Status"];
  const lines = [headers.join(";")];

  for (const r of modalRows) {
    lines.push([
      r.cliente,
      r.contrato || "",
      r.vendedor || "",
      r.traco || "",
      r.material || "",
      r.ultimaRemessa || "",
      r.quantidade != null ? String(r.quantidade).replace(".", ",") : "",
      r.diasSem != null ? String(r.diasSem) : "",
      STATUS[r.status]?.label || r.status
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(";"));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "historico_status.csv";
  a.click();
  URL.revokeObjectURL(url);
});

btnGoToDataFromModal.addEventListener("click", () => {
  closeModal();
  showOnly("data");
});

/* ====== Refresh geral (sempre que filtrar/clicar) ====== */
function refreshAll() {
  // aplica filtros
  shownRows = applyFilters(baseRows);

  // tabela
  renderTable(shownRows);

  // KPIs
  updateKPIs(shownRows);

  // chart options (anos/meses) precisam existir mesmo vazio
  ensureYearMonthOptions(shownRows);

  // chart
  renderChart(shownRows);

  // info
  recordsShown.textContent = String(shownRows.length);

  sourceNameEl.textContent = sourceMeta.name || "—";
  sourceCountEl.textContent = String(sourceMeta.consolidatedCount || 0);
  shownCountEl.textContent = String(shownRows.length);

  if (!baseRows.length) {
    sourceInfo.style.opacity = ".7";
  } else {
    sourceInfo.style.opacity = "1";
  }
}

/* ====== Helpers ====== */
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ====== Boot ====== */
(function init() {
  // tenta restaurar dados salvos
  const ok = restore();

  // se não tinha nada salvo, só renderiza vazio
  if (!ok) {
    updateImportUI();
    refreshAll();
  }

  // por padrão deixa tudo fechado (home apenas)
  showOnly("home");
})();
