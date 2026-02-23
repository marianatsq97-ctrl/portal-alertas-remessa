const STORAGE_DATA_KEY = "remessas_admin_data_v1";
const STORAGE_IMPORTS_KEY = "remessas_admin_imports_v1";

const state = {
  data: [],
  filtered: [],
  page: 1,
  pageSize: 8,
};

const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const demoData = [
  { cnpj: "12.345.678/0001-10", cliente: "Cliente Construtora Delta", contrato: "C-1003", nomeObra: "Condomínio Horizonte", volume: 20, ultimaRemessa: "2026-01-02" },
  { cnpj: "23.456.789/0001-11", cliente: "Cliente Pedra Forte", contrato: "C-1002", nomeObra: "Edifício Atlântico", volume: 7, ultimaRemessa: "2026-01-07" },
  { cnpj: "34.567.890/0001-12", cliente: "Cliente Areia Azul", contrato: "C-1001", nomeObra: "Residencial Aquarela", volume: 12, ultimaRemessa: "2026-01-11" },
];

const el = {
  fileInput: document.getElementById("fileInput"),
  uploadBtn: document.getElementById("uploadBtn"),
  demoBtn: document.getElementById("demoBtn"),
  clearBtn: document.getElementById("clearBtn"),
  yearFilter: document.getElementById("yearFilter"),
  monthFilter: document.getElementById("monthFilter"),
  startDate: document.getElementById("startDate"),
  endDate: document.getElementById("endDate"),
  statusText: document.getElementById("statusText"),
  chart: document.getElementById("chart"),
  tableBody: document.getElementById("tableBody"),
  tableMeta: document.getElementById("tableMeta"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  refreshChart: document.getElementById("refreshChart"),
  alertsTableBody: document.getElementById("alertsTableBody"),
  alertsMeta: document.getElementById("alertsMeta"),
  alertsGeneratedAt: document.getElementById("alertsGeneratedAt"),
  importHistoryBody: document.getElementById("importHistoryBody"),
  adminLastImport: document.getElementById("adminLastImport"),
  adminInfo: document.getElementById("adminInfo"),
};

function normalizeRecord(item) {
  const volume = Number(item.volume || 0);
  return {
    cnpj: item.cnpj || item.CNPJ || "-",
    cliente: item.cliente || item.NomeCliente || "-",
    contrato: item.contrato || item.Contrato || "-",
    nomeObra: item.nomeObra || item.NomeObra || "-",
    volume: Number.isFinite(volume) ? volume : Number(item.Volume || 0),
    ultimaRemessa: item.ultimaRemessa || item.DataUltimaRemessa,
  };
}

function parseDateSafe(date) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysWithoutShipment(date) {
  const parsed = parseDateSafe(date);
  if (!parsed) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today - parsed) / 86400000));
}

function statusFromDays(days) {
  if (days <= 7) return "ok";
  if (days <= 14) return "warn";
  if (days <= 21) return "alert";
  return "critical";
}

function statusLabel(status) {
  return { ok: "OK", warn: "Atenção", alert: "Atenção grave", critical: "Plano de ação" }[status];
}

function monthKey(dateString) {
  const d = parseDateSafe(dateString);
  if (!d) return "inválido";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(dateString) {
  const d = parseDateSafe(dateString);
  if (!d) return "inválido";
  return `${MONTH_NAMES[d.getMonth()]}/${d.getFullYear()}`;
}

function getImportHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_IMPORTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveImportHistory(history) {
  localStorage.setItem(STORAGE_IMPORTS_KEY, JSON.stringify(history.slice(0, 10)));
}

function registerImport(fileName, count) {
  const extension = (fileName.split(".").pop() || "").toUpperCase();
  const entry = {
    fileName,
    extension,
    count,
    importedAt: new Date().toISOString(),
  };
  const history = [entry, ...getImportHistory()];
  saveImportHistory(history);
  renderImportHistory();
}

function renderImportHistory() {
  const history = getImportHistory();
  if (!history.length) {
    el.importHistoryBody.innerHTML = '<tr><td colspan="4">Nenhuma importação registrada.</td></tr>';
    el.adminLastImport.textContent = "Sem importação recente";
    return;
  }

  el.importHistoryBody.innerHTML = history
    .map((item) => `<tr><td>${item.fileName}</td><td>${item.extension}</td><td>${new Date(item.importedAt).toLocaleString("pt-BR")}</td><td>${item.count}</td></tr>`)
    .join("");
  el.adminLastImport.textContent = `Última importação: ${new Date(history[0].importedAt).toLocaleString("pt-BR")}`;
}

function persistAdminData() {
  localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(state.data));
}

function restoreAdminData() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_DATA_KEY) || "[]");
    if (Array.isArray(data) && data.length) {
      state.data = data.map(normalizeRecord);
      el.adminInfo.textContent = "Dados do painel ADM carregados. Os usuários já visualizam a última importação.";
    }
  } catch {
    state.data = [];
  }
}

function updateFilters() {
  const years = [...new Set(state.data.map((item) => parseDateSafe(item.ultimaRemessa)).filter(Boolean).map((d) => d.getFullYear()))].sort((a, b) => a - b);
  el.yearFilter.innerHTML = `<option value="all">Ano: todos</option>${years.map((year) => `<option value="${year}">${year}</option>`).join("")}`;
  el.monthFilter.innerHTML = `<option value="all">Mês: todos</option>${MONTH_NAMES.map((month, index) => `<option value="${index + 1}">${month}</option>`).join("")}`;
}

function applyFilters() {
  const year = el.yearFilter.value;
  const month = el.monthFilter.value;
  const start = el.startDate.value ? new Date(el.startDate.value) : null;
  const end = el.endDate.value ? new Date(el.endDate.value) : null;

  state.filtered = state.data.filter((item) => {
    const d = parseDateSafe(item.ultimaRemessa);
    if (!d) return false;
    if (year !== "all" && d.getFullYear() !== Number(year)) return false;
    if (month !== "all" && d.getMonth() + 1 !== Number(month)) return false;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });

  state.filtered.sort((a, b) => daysWithoutShipment(b.ultimaRemessa) - daysWithoutShipment(a.ultimaRemessa));
  state.page = 1;
  renderAll();
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function renderSummary() {
  const uniqueClients = new Set(state.filtered.map((item) => item.cnpj)).size;
  const volumeTotal = state.filtered.reduce((sum, item) => sum + Number(item.volume), 0);
  const counters = { ok: 0, warn: 0, alert: 0, critical: 0 };

  state.filtered.forEach((item) => { counters[statusFromDays(daysWithoutShipment(item.ultimaRemessa))] += 1; });

  setText("contractsCount", state.filtered.length);
  setText("clientsCount", uniqueClients);
  setText("volumeCount", volumeTotal);
  setText("okCount", counters.ok);
  setText("warnCount", counters.warn);
  setText("alertCount", counters.alert);
  setText("criticalCount", counters.critical);
}

function renderChart() {
  const grouped = {};
  state.filtered.forEach((item) => { const key = monthKey(item.ultimaRemessa); grouped[key] = (grouped[key] || 0) + 1; });
  const entries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  const maxValue = Math.max(1, ...entries.map(([, value]) => value));

  if (!entries.length) {
    el.chart.innerHTML = "<p>Sem dados para exibir no gráfico.</p>";
    return;
  }

  el.chart.innerHTML = entries.map(([month, value]) => {
    const [year, mm] = month.split("-");
    const syntheticDate = `${year}-${mm}-01`;
    const height = 70 + (value / maxValue) * 170;
    return `<div class="bar"><div class="bar-inner" style="height:${height}px"></div><small>${value}</small><label>${monthLabel(syntheticDate)}</label></div>`;
  }).join("");
}

function renderTable() {
  const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const startIndex = (state.page - 1) * state.pageSize;
  const pageData = state.filtered.slice(startIndex, startIndex + state.pageSize);

  el.tableBody.innerHTML = pageData.map((item) => {
    const days = daysWithoutShipment(item.ultimaRemessa);
    const status = statusFromDays(days);
    const months = (days / 30).toFixed(1);
    const parsedDate = parseDateSafe(item.ultimaRemessa);
    const formattedDate = parsedDate ? parsedDate.toLocaleDateString("pt-BR") : "-";
    return `<tr><td>${item.cnpj}<br>${item.cliente}</td><td>${item.contrato}</td><td>${item.nomeObra}</td><td>${item.volume}</td><td>${formattedDate}</td><td>${days} dias (${months} meses)</td><td><span class="badge ${status}">${statusLabel(status)}</span></td></tr>`;
  }).join("");

  el.tableMeta.textContent = `Ordenado da maior para a menor urgência (dias sem remessa). Mostrando ${pageData.length} de ${state.filtered.length} registros • Página ${state.page}/${totalPages}`;
  el.prevPage.disabled = state.page <= 1;
  el.nextPage.disabled = state.page >= totalPages;
}

function renderAll() {
  renderSummary();
  renderChart();
  renderTable();
}

function parseCsvLine(line, delimiter) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const isEscapedQuote = inQuotes && line[i + 1] === '"';
      if (isEscapedQuote) {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const keys = parseCsvLine(lines[0], delimiter);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    const obj = {};
    keys.forEach((key, i) => { obj[key] = values[i] || ""; });
    return normalizeRecord(obj);
  });
}

function parseWorkbook(arrayBuffer) {
  if (typeof XLSX === "undefined") throw new Error("Leitor XLS/XLSX indisponível no navegador.");
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  return rows.map((row) => normalizeRecord(row));
}

async function parseUploadedFile(file) {
  const extension = (file.name.toLowerCase().split(".").pop() || "").trim();
  if (["csv", "csc"].includes(extension)) return parseCsv(await file.text());
  if (["xls", "xlsx"].includes(extension)) return parseWorkbook(await file.arrayBuffer());
  if (extension === "json") return JSON.parse(await file.text()).map(normalizeRecord);
  throw new Error("Formato não suportado. Use CSC/CSV/XLS/XLSX/JSON.");
}

function loadRecords(records, sourceLabel, sourceFile = "manual") {
  state.data = records.filter((item) => item.ultimaRemessa).map(normalizeRecord);
  persistAdminData();
  registerImport(sourceFile, state.data.length);
  updateFilters();
  applyFilters();
  el.statusText.textContent = `${sourceLabel} carregado com sucesso (${state.data.length} registros). Usuários já podem visualizar.`;
}

function renderAlertsRows(alertData) {
  const rows = alertData.alertas || [];
  el.alertsGeneratedAt.textContent = `Gerado em: ${alertData.gerado_em || "-"}`;
  el.alertsMeta.innerHTML = `Regra: se <strong>data de hoje - data da última remessa &gt; 7</strong>, status = <strong>PLANO DE AÇÃO</strong>. Total de alertas: <strong>${rows.length}</strong>.`;

  if (!rows.length) {
    el.alertsTableBody.innerHTML = '<tr><td colspan="5">✅ Nenhum cliente acima de 7 dias sem remessa.</td></tr>';
    return;
  }

  el.alertsTableBody.innerHTML = rows.map((row) => `<tr><td>${row.CodCliente} - ${row.NomeCliente}</td><td>${row.DataUltimaRemessa}</td><td>${row.DiasSemRemessa}</td><td><span class="badge critical">Plano de ação</span></td><td>${row.Acao || "Criar PLANO DE AÇÃO"}</td></tr>`).join("");
}

async function loadGeneratedAlerts() {
  try {
    const response = await fetch("./alerts.json", { cache: "no-store" });
    if (!response.ok) throw new Error("alerts.json não encontrado");
    renderAlertsRows(await response.json());
  } catch {
    renderAlertsRows({ gerado_em: new Date().toISOString().slice(0, 10), alertas: [] });
  }
}

el.fileInput.addEventListener("change", () => {
  const file = el.fileInput.files[0];
  if (file) el.statusText.textContent = `Arquivo selecionado no painel ADM: ${file.name} (CSC/CSV/XLS/XLSX/JSON)`;
});

el.demoBtn.addEventListener("click", () => loadRecords(demoData, "Demo", "demo_local"));

el.uploadBtn.addEventListener("click", async () => {
  const file = el.fileInput.files[0];
  if (!file) {
    el.statusText.textContent = "Selecione um arquivo primeiro no painel ADM.";
    return;
  }

  try {
    const records = await parseUploadedFile(file);
    loadRecords(records, "Arquivo", file.name);
  } catch (error) {
    el.statusText.textContent = `Falha ao carregar arquivo: ${error.message}`;
  }
});

el.clearBtn.addEventListener("click", () => {
  state.data = [];
  state.filtered = [];
  state.page = 1;
  localStorage.removeItem(STORAGE_DATA_KEY);
  localStorage.removeItem(STORAGE_IMPORTS_KEY);
  updateFilters();
  renderAll();
  renderImportHistory();
  el.fileInput.value = "";
  el.statusText.textContent = "Dados limpos.";
});

[el.yearFilter, el.monthFilter, el.startDate, el.endDate].forEach((item) => item.addEventListener("change", applyFilters));
el.refreshChart.addEventListener("click", renderChart);

el.prevPage.addEventListener("click", () => {
  state.page = Math.max(1, state.page - 1);
  renderTable();
});

el.nextPage.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
  state.page = Math.min(totalPages, state.page + 1);
  renderTable();
});

restoreAdminData();
updateFilters();
applyFilters();
renderImportHistory();
loadGeneratedAlerts();
