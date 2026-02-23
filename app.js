const tableBody = document.getElementById("tableBody");
const recordsInfo = document.getElementById("recordsInfo");
const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const statusMsg = document.getElementById("statusMsg");
const chartBars = document.getElementById("chartBars");
const chartLabels = document.getElementById("chartLabels");

const monthFilter = document.getElementById("monthFilter");
const yearFilter = document.getElementById("yearFilter");

const materialsToggle = document.getElementById("materialsToggle");
const buildInfo = document.getElementById("buildInfo");

let rawData = [];

// ===============================
// UTIL: normalização de chaves
// ===============================
function normKey(k) {
  return String(k || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\s+/g, " ");
}

function toNumber(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (!s) return 0;
  // troca separadores comuns
  const cleaned = s
    .replace(/\./g, "") // tira milhar
    .replace(/,/g, "."); // decimal
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// ===============================
// DATA: aceita string, Date, serial Excel, ISO
// ===============================
function excelSerialToDate(serial) {
  // Excel serial (com correção do bug 1900)
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  // mantém no fuso local
  return new Date(dateInfo.getFullYear(), dateInfo.getMonth(), dateInfo.getDate());
}

function parseAnyDate(value) {
  if (!value) return null;

  // Já é Date
  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  // Número (serial Excel)
  if (typeof value === "number" && Number.isFinite(value)) {
    // Heurística: serial excel geralmente > 20000
    if (value > 20000) return excelSerialToDate(value);
    // se for timestamp em ms
    if (value > 10000000000) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    return null;
  }

  const s = String(value).trim();
  if (!s) return null;

  // dd/mm/yyyy
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const d = Number(br[1]), m = Number(br[2]), y = Number(br[3]);
    const dt = new Date(y, m - 1, d);
    if (!isNaN(dt.getTime())) return dt;
  }

  // yyyy-mm-dd ou ISO
  const isoTry = new Date(s);
  if (!isNaN(isoTry.getTime())) {
    return new Date(isoTry.getFullYear(), isoTry.getMonth(), isoTry.getDate());
  }

  return null;
}

function formatBRDate(dt) {
  if (!dt) return "";
  const d = String(dt.getDate()).padStart(2, "0");
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const y = dt.getFullYear();
  return `${d}/${m}/${y}`;
}

function daysWithoutShipment(dateValue) {
  const date = parseAnyDate(dateValue);
  if (!date) return 0;
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((t0.getTime() - date.getTime()) / 86400000);
}

function statusFromDays(days) {
  if (days <= 7) return { text: "OK", css: "ok" };
  if (days <= 14) return { text: "Atenção", css: "warn" };
  if (days <= 21) return { text: "Atenção grave", css: "grave" };
  return { text: "Plano de ação", css: "action" };
}

// ===============================
// MAPEAMENTO DE COLUNAS
// Ajuste aqui se seu XLSX tiver nomes diferentes
// ===============================
const FIELD_MAP = {
  contrato: ["contrato", "n contrato", "numero contrato", "contrato id"],
  cliente: ["cliente", "nome cliente", "razao social", "razao", "empresa"],
  cnpj: ["cnpj", "cpf/cnpj", "documento", "cnpj/cpf"],
  obra: ["obra", "nome da obra", "projeto", "empreendimento"],
  volume: ["volume", "volume da obra", "qtd obra", "quantidade obra", "volume_total"],
  quantidade: ["quantidade", "qtd", "volume remessa", "total", "toneladas", "m3"],
  dataRemessa: ["data da remessa", "ultima remessa", "última remessa", "data remessa", "dt remessa", "data"]
};

function pickField(row, possibleKeys) {
  const keys = Object.keys(row);
  for (const alias of possibleKeys) {
    const nk = normKey(alias);
    const found = keys.find(k => normKey(k) === nk);
    if (found !== undefined) return row[found];
  }
  return "";
}

function normalizeRow(row) {
  // Aceita row vindo do XLSX/CSV/JSON
  const contrato = pickField(row, FIELD_MAP.contrato);
  const cliente = pickField(row, FIELD_MAP.cliente);
  const cnpj = pickField(row, FIELD_MAP.cnpj);
  const obra = pickField(row, FIELD_MAP.obra);
  const volume = pickField(row, FIELD_MAP.volume);
  const qtd = pickField(row, FIELD_MAP.quantidade);

  const dr = pickField(row, FIELD_MAP.dataRemessa);
  const dt = parseAnyDate(dr);

  return {
    Contrato: String(contrato || "").trim(),
    Cliente: String(cliente || "").trim(),
    CNPJ: String(cnpj || "").trim(),
    Obra: String(obra || "").trim(),
    "Volume da obra": toNumber(volume),
    Quantidade: toNumber(qtd),
    "Data da remessa": dt ? formatBRDate(dt) : ""
  };
}

function isValidRow(r) {
  // evita linhas vazias e cabeçalhos duplicados
  const hasAny =
    (r.Contrato && r.Contrato !== "-") ||
    (r.Cliente && r.Cliente !== "-") ||
    (r.CNPJ && r.CNPJ !== "-") ||
    (r["Data da remessa"] && r["Data da remessa"] !== "-");
  return Boolean(hasAny);
}

// ===============================
// FILTROS
// ===============================
function populateFilters(data) {
  const dates = data
    .map(item => parseAnyDate(item["Data da remessa"]))
    .filter(Boolean);

  const years = [...new Set(dates.map(d => d.getFullYear()))].sort((a, b) => a - b);
  const months = [...new Set(dates.map(d => d.getMonth() + 1))].sort((a, b) => a - b);

  yearFilter.innerHTML =
    '<option value="todos">Ano: todos</option>' +
    years.map(y => `<option value="${y}">Ano: ${y}</option>`).join("");

  monthFilter.innerHTML =
    '<option value="todos">Mês: todos</option>' +
    months.map(m => `<option value="${m}">Mês: ${String(m).padStart(2, "0")}</option>`).join("");
}

function filteredData() {
  return rawData.filter(item => {
    const dt = parseAnyDate(item["Data da remessa"]);
    if (!dt) return false;

    const yearOk = yearFilter.value === "todos" || String(dt.getFullYear()) === yearFilter.value;
    const monthOk = monthFilter.value === "todos" || String(dt.getMonth() + 1) === monthFilter.value;

    return yearOk && monthOk;
  });
}

// ===============================
// RENDER
// ===============================
function updateSummary(data) {
  const count = { ok: 0, warn: 0, grave: 0, action: 0 };

  data.forEach(item => {
    const st = statusFromDays(daysWithoutShipment(item["Data da remessa"]));
    count[st.css] += 1;
  });

  document.getElementById("ok").textContent = count.ok;
  document.getElementById("warn").textContent = count.warn;
  document.getElementById("grave").textContent = count.grave;
  document.getElementById("action").textContent = count.action;

  document.getElementById("contratos").textContent = new Set(data.map(item => item.Contrato).filter(Boolean)).size;

  // clientes únicos por CNPJ se tiver, senão por Cliente
  const clientKey = data.map(i => (i.CNPJ || i.Cliente || "").trim()).filter(Boolean);
  document.getElementById("clientes").textContent = new Set(clientKey).size;

  document.getElementById("volume").textContent = data.reduce((acc, item) => acc + Number(item["Volume da obra"] || 0), 0);
}

function renderChart(data) {
  const grouped = {};
  data.forEach(item => {
    const dt = parseAnyDate(item["Data da remessa"]);
    if (!dt) return;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    grouped[key] = (grouped[key] || 0) + Number(item["Volume da obra"] || 0);
  });

  const entries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(...entries.map(([, value]) => value), 1);

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
    text.style.width = "58px";
    text.style.textAlign = "center";
    chartLabels.appendChild(text);
  });
}

function renderTable(data) {
  const sorted = [...data].sort(
    (a, b) => daysWithoutShipment(b["Data da remessa"]) - daysWithoutShipment(a["Data da remessa"])
  );

  tableBody.innerHTML = sorted
    .map(item => {
      const days = daysWithoutShipment(item["Data da remessa"]);
      const status = statusFromDays(days);
      const months = (days / 30).toFixed(1);

      const cnpjCliente = [item.CNPJ, item.Cliente].filter(Boolean).join(" • ");
      const obra = item.Obra || "-";

      return `
        <tr>
          <td>${cnpjCliente || "-"}</td>
          <td>${item.Contrato || "-"}</td>
          <td>${obra}</td>
          <td>${Number(item["Volume da obra"] || 0)}</td>
          <td>${item["Data da remessa"] || "-"}</td>
          <td>${days} dias (${months} meses)</td>
          <td><span class="badge ${status.css}">${status.text}</span></td>
        </tr>`;
    })
    .join("");

  recordsInfo.textContent = `Mostrando ${sorted.length} registros`;
}

function renderAll() {
  const data = filteredData();
  updateSummary(data);
  renderChart(data);
  renderTable(data);

  buildInfo.textContent = `Build atualizado • Registros carregados: ${rawData.length} • Exibindo: ${data.length}`;
}

// ===============================
// IMPORTAÇÃO DE ARQUIVOS
// XLSX / CSV / JSON
// ===============================
async function loadDemo() {
  const response = await fetch("data/demo.json");
  const demo = await response.json();
  rawData = demo.map(normalizeRow).filter(isValidRow);

  populateFilters(rawData);
  renderAll();
  statusMsg.textContent = "Demo carregada com sucesso.";
}

function clearData() {
  rawData = [];
  tableBody.innerHTML = "";
  chartBars.innerHTML = "";
  chartLabels.innerHTML = "";
  recordsInfo.textContent = "Mostrando 0 registros";

  ["ok", "warn", "grave", "action", "contratos", "clientes", "volume"].forEach(id => {
    document.getElementById(id).textContent = "0";
  });

  statusMsg.textContent = "Dados removidos.";
  buildInfo.textContent = "Build atualizado";
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(String(e.target.result || ""));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function importXLSX(file) {
  const buf = await readFileAsArrayBuffer(file);
  const wb = XLSX.read(buf, { type: "array" });

  // pega a primeira aba
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // transforma em JSON completo
  const json = XLSX.utils.sheet_to_json(ws, {
    defval: "",
    raw: true
  });

  const normalized = json.map(normalizeRow).filter(isValidRow);

  rawData = normalized;
  populateFilters(rawData);
  renderAll();

  statusMsg.textContent = `XLSX carregado: ${rawData.length} linhas (aba: ${sheetName}).`;
}

async function importCSV(file) {
  const text = await readFileAsText(file);

  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true
  });

  const rows = (parsed.data || []).map(normalizeRow).filter(isValidRow);

  rawData = rows;
  populateFilters(rawData);
  renderAll();

  statusMsg.textContent = `CSV carregado: ${rawData.length} linhas.`;
}

async function importJSON(file) {
  const text = await readFileAsText(file);
  const data = JSON.parse(text);

  // se vier objeto com "data" dentro, pega
  const rows = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
  rawData = rows.map(normalizeRow).filter(isValidRow);

  populateFilters(rawData);
  renderAll();

  statusMsg.textContent = `JSON carregado: ${rawData.length} linhas.`;
}

async function readSelectedFile() {
  const file = fileInput.files?.[0];
  if (!file) {
    statusMsg.textContent = "Selecione um arquivo antes de carregar.";
    return;
  }

  fileName.textContent = file.name;
  statusMsg.textContent = "Carregando...";

  const ext = file.name.toLowerCase().split(".").pop();

  try {
    if (ext === "xlsx" || ext === "xls") {
      await importXLSX(file);
    } else if (ext === "csv") {
      await importCSV(file);
    } else if (ext === "json") {
      await importJSON(file);
    } else {
      statusMsg.textContent = "Formato não suportado. Use: .xlsx .xls .csv .json";
    }
  } catch (err) {
    console.error(err);
    statusMsg.textContent = "Erro ao carregar arquivo. Verifique o formato e tente novamente.";
  }
}

// ===============================
// EVENTOS
// ===============================
document.getElementById("loadFileBtn").addEventListener("click", readSelectedFile);
document.getElementById("loadDemoBtn").addEventListener("click", loadDemo);
document.getElementById("clearBtn").addEventListener("click", clearData);
document.getElementById("refreshChartBtn").addEventListener("click", renderAll);

fileInput.addEventListener("change", () => {
  fileName.textContent = fileInput.files?.[0]?.name || "Nenhum arquivo selecionado";
});

yearFilter.addEventListener("change", renderAll);
monthFilter.addEventListener("change", renderAll);

document.getElementById("logoutBtn").addEventListener("click", () => {
  alert("Saída simulada (ajustar conforme portal ADM/Usuário).");
});

// inicial
loadDemo();
