const STORAGE_DATA_KEY = "remessas_admin_data_v1";
const ROLE_KEY = "role";

const state = {
  data: [],
  filtered: [],
  page: 1,
  pageSize: 8,
};

const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const el = {
  fileInput: document.getElementById("fileInput"),
  uploadBtn: document.getElementById("uploadBtn"),
  clearBtn: document.getElementById("clearBtn"),
  yearFilter: document.getElementById("yearFilter"),
  monthFilter: document.getElementById("monthFilter"),
  statusText: document.getElementById("statusText"),
  roleTag: document.getElementById("roleTag"),
  adminControls: document.getElementById("adminControls"),
  logoutBtn: document.getElementById("logoutBtn"),
  chart: document.getElementById("chart"),
  tableBody: document.getElementById("tableBody"),
  tableMeta: document.getElementById("tableMeta"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  refreshChart: document.getElementById("refreshChart"),
};

const role = localStorage.getItem(ROLE_KEY);
if (!["admin", "user"].includes(role || "")) {
  window.location.replace("login.html");
}

function normalizeRecord(item) {
  const volumeRaw = item.volume ?? item.Volume ?? item.Quantidade ?? item.ConsumoTotal ?? 0;
  const parsedDate = (item.ultimaRemessa || item.DataUltimaRemessa || item["Data da remessa"] || "").toString().trim();

  return {
    cnpj: item.cnpj || item.CNPJ || item.CodCliente || item.Cliente || "-",
    cliente: item.cliente || item.NomeCliente || item.ClienteNome || "-",
    contrato: item.contrato || item.Contrato || "-",
    nomeObra: item.nomeObra || item.NomeObra || item["Nome da obra"] || "-",
    volume: Number(volumeRaw) || 0,
    ultimaRemessa: parsedDate,
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

function persistAdminData() {
  localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(state.data));
}

function updateFilters() {
  const years = [...new Set(state.data
    .map((item) => parseDateSafe(item.ultimaRemessa))
    .filter(Boolean)
    .map((d) => d.getFullYear()))].sort((a, b) => a - b);

  el.yearFilter.innerHTML = `<option value="all">Ano: todos</option>${years.map((year) => `<option value="${year}">${year}</option>`).join("")}`;
  el.monthFilter.innerHTML = `<option value="all">Mês: todos</option>${MONTH_NAMES.map((month, index) => `<option value="${index + 1}">${month}</option>`).join("")}`;
}

function applyFilters() {
  const year = el.yearFilter.value;
  const month = el.monthFilter.value;

  state.filtered = state.data.filter((item) => {
    const d = parseDateSafe(item.ultimaRemessa);
    if (!d) return false;
    if (year !== "all" && d.getFullYear() !== Number(year)) return false;
    if (month !== "all" && d.getMonth() + 1 !== Number(month)) return false;
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

  state.filtered.forEach((item) => {
    counters[statusFromDays(daysWithoutShipment(item.ultimaRemessa))] += 1;
  });

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

  state.filtered.forEach((item) => {
    const d = parseDateSafe(item.ultimaRemessa);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    grouped[key] = (grouped[key] || 0) + 1;
  });

  const entries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  const maxValue = Math.max(1, ...entries.map(([, value]) => value));

  if (!entries.length) {
    el.chart.innerHTML = "<p>Sem dados para exibir no gráfico.</p>";
    return;
  }

  el.chart.innerHTML = entries
    .map(([month, value]) => {
      const [year, mm] = month.split("-");
      const label = `${year}-${mm}`;
      const height = 70 + (value / maxValue) * 170;
      return `<div class=\"bar\"><div class=\"bar-inner\" style=\"height:${height}px\"></div><small>${value}</small><label>${label}</label></div>`;
    })
    .join("");
}

function renderTable() {
  const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const startIndex = (state.page - 1) * state.pageSize;
  const pageData = state.filtered.slice(startIndex, startIndex + state.pageSize);

  el.tableBody.innerHTML = pageData
    .map((item) => {
      const days = daysWithoutShipment(item.ultimaRemessa);
      const status = statusFromDays(days);
      const months = (days / 30).toFixed(1);
      const parsedDate = parseDateSafe(item.ultimaRemessa);
      const formattedDate = parsedDate ? parsedDate.toLocaleDateString("pt-BR") : "-";
      return `<tr><td>${item.cnpj}<br>${item.cliente}</td><td>${item.contrato}</td><td>${item.nomeObra}</td><td>${item.volume}</td><td>${formattedDate}</td><td>${days} dias (${months} meses)</td><td><span class=\"badge ${status}\">${statusLabel(status)}</span></td></tr>`;
    })
    .join("");

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
    keys.forEach((key, i) => {
      obj[key] = values[i] || "";
    });
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
  if (extension === "json") {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed)) throw new Error("JSON inválido: esperado array de registros.");
    return parsed.map((row) => normalizeRecord(row));
  }

  throw new Error("Formato não suportado. Use CSC/CSV/XLS/XLSX/JSON.");
}

function applyRoleUI() {
  const currentRole = role === "admin" ? "Administrador" : "Usuário";
  el.roleTag.textContent = `Perfil: ${currentRole}`;

  if (role !== "admin") {
    el.adminControls.classList.add("hidden");
    el.statusText.textContent = "Acesso de usuário: visualização habilitada. Importação disponível apenas para ADM.";
  }
}

async function loadSeedDataIfNeeded() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_DATA_KEY) || "[]");
    if (Array.isArray(saved) && saved.length) {
      state.data = saved.map((item) => normalizeRecord(item)).filter((item) => item.ultimaRemessa);
      return;
    }
  } catch {
    state.data = [];
  }

  try {
    const response = await fetch("./data/demo.json", { cache: "no-store" });
    if (!response.ok) throw new Error("demo indisponível");
    const seed = await response.json();
    if (!Array.isArray(seed)) throw new Error("demo inválida");
    state.data = seed.map((item) => normalizeRecord(item)).filter((item) => item.ultimaRemessa);
    persistAdminData();
    el.statusText.textContent = "Dados iniciais carregados com sucesso.";
  } catch {
    state.data = [];
    if (role === "admin") {
      el.statusText.textContent = "Nenhum dado carregado. Faça upload para iniciar.";
    }
  }
}

el.fileInput.addEventListener("change", () => {
  const file = el.fileInput.files[0];
  if (file) el.statusText.textContent = `Arquivo selecionado: ${file.name}`;
});

el.uploadBtn.addEventListener("click", async () => {
  if (role !== "admin") return;

  const file = el.fileInput.files[0];
  if (!file) {
    el.statusText.textContent = "Selecione um arquivo para carregar.";
    return;
  }

  try {
    const records = await parseUploadedFile(file);
    state.data = records.filter((item) => item.ultimaRemessa);
    persistAdminData();
    updateFilters();
    applyFilters();
    el.statusText.textContent = `Arquivo carregado com sucesso (${state.data.length} registros).`;
  } catch (error) {
    el.statusText.textContent = `Falha ao carregar arquivo: ${error.message}`;
  }
});

el.clearBtn.addEventListener("click", () => {
  if (role !== "admin") return;

  state.data = [];
  state.filtered = [];
  state.page = 1;
  localStorage.removeItem(STORAGE_DATA_KEY);
  updateFilters();
  renderAll();
  el.fileInput.value = "";
  el.statusText.textContent = "Dados limpos.";
});

[el.yearFilter, el.monthFilter].forEach((item) => item.addEventListener("change", applyFilters));

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

el.logoutBtn.addEventListener("click", () => {
  localStorage.removeItem(ROLE_KEY);
  window.location.replace("login.html");
});

(async function init() {
  applyRoleUI();
  await loadSeedDataIfNeeded();
  updateFilters();
  applyFilters();
})();
