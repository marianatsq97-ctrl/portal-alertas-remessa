/* ==============================
   PORTAL ALERTAS - REMESSAS
   ============================== */

/* ======= LOGIN GUARD ======= */
const role = localStorage.getItem("role");
if (!role) {
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      localStorage.removeItem("role");
      window.location.href = "login.html";
    });
  }
});

/* ======= ELEMENTOS ======= */
const adminPanel = document.getElementById("adminPanel");
const fileInput = document.getElementById("fileInput");
const loadFileBtn = document.getElementById("loadFileBtn");
const clearBtn = document.getElementById("clearBtn");
const statusMsg = document.getElementById("statusMsg");

const yearFilter = document.getElementById("yearFilter");
const monthFilter = document.getElementById("monthFilter");

const tableBody = document.getElementById("tableBody");

const kpiContracts = document.getElementById("kpiContracts");
const kpiClients = document.getElementById("kpiClients");
const kpiVolume = document.getElementById("kpiVolume");

const kpiOK = document.getElementById("kpiOK");
const kpiWarn = document.getElementById("kpiWarn");
const kpiGrave = document.getElementById("kpiGrave");
const kpiAction = document.getElementById("kpiAction");

const buildInfo = document.getElementById("buildInfo");

/* ======= VISIBILIDADE ADMIN ======= */
if (role !== "admin" && adminPanel) {
  adminPanel.style.display = "none";
}

/* ======= ESTADO ======= */
let allRows = [];      // normalizado
let filteredRows = []; // filtrado por ano/mês

/* ======= UTIL ======= */
function setStatus(t) {
  if (statusMsg) statusMsg.textContent = t || "";
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) {
      const v = obj[k];
      if (v !== null && v !== undefined && String(v).trim() !== "") return v;
    }
  }
  return "";
}

function parseExcelDate(v) {
  if (!v) return null;

  if (v instanceof Date) return v;

  if (typeof v === "number") {
    // Excel serial date
    const d = new Date((v - 25569) * 86400 * 1000);
    return isNaN(d) ? null : d;
  }

  const s = String(v).trim();

  // DD/MM/YYYY
  const parts = s.split("/");
  if (parts.length === 3) {
    const dd = Number(parts[0]);
    const mm = Number(parts[1]) - 1;
    const yy = Number(parts[2]);
    const d = new Date(yy, mm, dd);
    return isNaN(d) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function formatDateBR(d) {
  if (!d || isNaN(d)) return "";
  return d.toLocaleDateString("pt-BR");
}

function safeNumberBR(v) {
  // aceita "1.234,56" / "1234,56" / "1234.56" / "1234"
  const s = String(v || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function daysSince(dateObj) {
  if (!dateObj) return null;
  const diff = Date.now() - dateObj.getTime();
  return Math.floor(diff / 86400000);
}

function formatDaysSmart(days) {
  if (days === null) return "";
  if (days > 365) return `${(days / 365).toFixed(1)} anos`;
  if (days > 31) return `${(days / 30).toFixed(1)} meses`;
  return `${days} dias`;
}

function statusFromDays(days) {
  if (days === null) return { text: "", css: "" };
  if (days <= 7) return { text: "OK", css: "tag ok" };
  if (days <= 14) return { text: "Atenção", css: "tag warn" };
  if (days <= 21) return { text: "Atenção grave", css: "tag grave" };
  return { text: "Plano de ação", css: "tag action" };
}

/* ======= NORMALIZAÇÃO XLSX ======= */
function normalizeRows(rows) {
  return rows.map((r) => {
    const cnpj = String(
      pick(r, ["CNPJ", "CNPJ / Cliente", "CNPJ/Cliente", "Cliente", "CNPJ_CLIENTE"])
    ).trim();

    const contrato = String(
      pick(r, ["Contrato", "CONTRATO", "Nº Contrato", "NUM_CONTRATO", "CONTR"])
    ).trim();

    const obra = String(
      pick(r, ["Nome da obra", "OBRA", "Obra", "NOME_OBRA", "EMPREENDEDIMENTO"])
    ).trim();

    // VOLUME: tenta vários nomes
    const volumeRaw = pick(r, [
      "Volume da obra",
      "VOLUME DA OBRA",
      "Volume",
      "VOLUME",
      "Quantidade",
      "QTDE",
      "QTD",
      "TOTAL",
      "VALOR"
    ]);
    const volume = safeNumberBR(volumeRaw);

    // ÚLTIMA REMESSA / DATA
    const lastDateRaw = pick(r, [
      "Última remessa",
      "ULTIMA REMESSA",
      "Data última remessa",
      "DATA ULTIMA REMESSA",
      "Data",
      "DATA"
    ]);
    const lastDate = parseExcelDate(lastDateRaw);

    return {
      cnpj,
      contrato,
      obra,
      volume,
      lastDate,
      year: lastDate ? lastDate.getFullYear() : null,
      month: lastDate ? String(lastDate.getMonth() + 1).padStart(2, "0") : null
    };
  });
}

/* ======= FILTROS ======= */
function rebuildFilters() {
  if (!yearFilter || !monthFilter) return;

  const years = Array.from(new Set(allRows.map(r => r.year).filter(Boolean))).sort((a,b)=>a-b);
  const months = Array.from(new Set(allRows.map(r => r.month).filter(Boolean))).sort();

  yearFilter.innerHTML = `<option value="">Ano: todos</option>` + years.map(y => `<option value="${y}">${y}</option>`).join("");
  monthFilter.innerHTML = `<option value="">Mês: todos</option>` + months.map(m => `<option value="${m}">${m}</option>`).join("");

  yearFilter.value = "";
  monthFilter.value = "";
}

function applyFilters() {
  const y = yearFilter ? yearFilter.value : "";
  const m = monthFilter ? monthFilter.value : "";

  filteredRows = allRows.filter(r => {
    if (y && String(r.year) !== String(y)) return false;
    if (m && String(r.month) !== String(m)) return false;
    return true;
  });

  render();
}

/* ======= KPIs e TABELA ======= */
function render() {
  // ordena por dias sem remessa (maior primeiro)
  const sorted = [...filteredRows].sort((a, b) => {
    const da = daysSince(a.lastDate) ?? -1;
    const db = daysSince(b.lastDate) ?? -1;
    return db - da;
  });

  // tabela
  if (tableBody) {
    tableBody.innerHTML = sorted.map((r) => {
      const d = daysSince(r.lastDate);
      const st = statusFromDays(d);

      return `
        <tr>
          <td>${r.cnpj || ""}</td>
          <td>${r.contrato || ""}</td>
          <td>${r.obra || ""}</td>
          <td>${r.volume ? r.volume.toLocaleString("pt-BR") : ""}</td>
          <td>${formatDateBR(r.lastDate)}</td>
          <td>${formatDaysSmart(d)}</td>
          <td><span class="${st.css}">${st.text}</span></td>
        </tr>
      `;
    }).join("");
  }

  // KPIs
  const contratos = new Set(sorted.map(r => r.contrato).filter(Boolean)).size;
  const clientes = new Set(sorted.map(r => r.cnpj).filter(Boolean)).size;
  const volumeTotal = sorted.reduce((acc, r) => acc + (r.volume || 0), 0);

  if (kpiContracts) kpiContracts.textContent = String(contratos);
  if (kpiClients) kpiClients.textContent = String(clientes);
  if (kpiVolume) kpiVolume.textContent = volumeTotal ? volumeTotal.toLocaleString("pt-BR") : "0";

  const counters = { ok: 0, warn: 0, grave: 0, action: 0 };
  sorted.forEach(r => {
    const d = daysSince(r.lastDate);
    const st = statusFromDays(d).css;
    if (st.includes("ok")) counters.ok++;
    else if (st.includes("warn")) counters.warn++;
    else if (st.includes("grave")) counters.grave++;
    else if (st.includes("action")) counters.action++;
  });

  if (kpiOK) kpiOK.textContent = String(counters.ok);
  if (kpiWarn) kpiWarn.textContent = String(counters.warn);
  if (kpiGrave) kpiGrave.textContent = String(counters.grave);
  if (kpiAction) kpiAction.textContent = String(counters.action);

  if (buildInfo) {
    const now = new Date();
    buildInfo.textContent = `Build atualizado • ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR")}`;
  }
}

/* ======= IMPORTAÇÃO (ADMIN) ======= */
async function loadXlsx(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  allRows = normalizeRows(rows);

  rebuildFilters();
  applyFilters();

  setStatus(`XLSX carregado: ${rows.length} linhas`);
}

/* ======= EVENTOS ======= */
if (loadFileBtn) {
  loadFileBtn.addEventListener("click", async () => {
    if (role !== "admin") return;

    const file = fileInput?.files?.[0];
    if (!file) {
      setStatus("Selecione um XLSX.");
      return;
    }

    try {
      setStatus("Carregando XLSX...");
      await loadXlsx(file);
    } catch (e) {
      console.error(e);
      setStatus("Erro ao ler o XLSX. Verifique o arquivo.");
    }
  });
}

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    if (role !== "admin") return;

    allRows = [];
    filteredRows = [];
    rebuildFilters();
    render();
    setStatus("Dados removidos.");
  });
}

if (yearFilter) yearFilter.addEventListener("change", applyFilters);
if (monthFilter) monthFilter.addEventListener("change", applyFilters);

/* ======= INÍCIO ======= */
(function init() {
  // Não carrega demo. Não inventa dados.
  // Sempre inicia vazio.
  allRows = [];
  filteredRows = [];
  rebuildFilters();
  render();
  setStatus(role === "admin" ? "Aguardando importação…" : "Acesso de usuário (visualização).");
})();
