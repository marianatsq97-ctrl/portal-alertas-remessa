const tableBody = document.getElementById("tableBody");
const recordsInfo = document.getElementById("recordsInfo");
const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const statusMsg = document.getElementById("statusMsg");
const chartBars = document.getElementById("chartBars");
const chartLabels = document.getElementById("chartLabels");
const monthFilter = document.getElementById("monthFilter");
const yearFilter = document.getElementById("yearFilter");

let rawData = [];

/* ===========================
   FUNÇÕES DE DATA FLEXÍVEL
=========================== */

function parseDate(value) {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (typeof value === "number") {
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }

  const str = String(value).trim();

  const br = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return new Date(br[3], br[2] - 1, br[1]);

  const iso = new Date(str);
  if (!isNaN(iso)) return iso;

  return null;
}

function daysWithoutShipment(dateValue) {
  const date = parseDate(dateValue);
  if (!date) return 0;
  const today = new Date();
  return Math.floor((today - date) / 86400000);
}

function statusFromDays(days) {
  if (days <= 7) return { text: "OK", css: "ok" };
  if (days <= 14) return { text: "Atenção", css: "warn" };
  if (days <= 21) return { text: "Atenção grave", css: "grave" };
  return { text: "Plano de ação", css: "action" };
}

/* ===========================
   FILTROS
=========================== */

function populateFilters(data) {
  const dates = data.map(i => parseDate(i.data)).filter(Boolean);

  const years = [...new Set(dates.map(d => d.getFullYear()))].sort();
  const months = [...new Set(dates.map(d => d.getMonth() + 1))].sort((a,b)=>a-b);

  yearFilter.innerHTML =
    '<option value="todos">Ano: todos</option>' +
    years.map(y => `<option value="${y}">Ano: ${y}</option>`).join("");

  monthFilter.innerHTML =
    '<option value="todos">Mês: todos</option>' +
    months.map(m => `<option value="${m}">Mês: ${String(m).padStart(2,"0")}</option>`).join("");
}

function filteredData() {
  return rawData.filter(item => {
    const dt = parseDate(item.data);
    if (!dt) return false;

    const yearOk =
      yearFilter.value === "todos" ||
      String(dt.getFullYear()) === yearFilter.value;

    const monthOk =
      monthFilter.value === "todos" ||
      String(dt.getMonth() + 1) === monthFilter.value;

    return yearOk && monthOk;
  });
}

/* ===========================
   RENDER
=========================== */

function updateSummary(data) {
  const count = { ok: 0, warn: 0, grave: 0, action: 0 };

  data.forEach(item => {
    const st = statusFromDays(daysWithoutShipment(item.data));
    count[st.css] += 1;
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

function renderTable(data) {
  const sorted = [...data].sort(
    (a, b) =>
      daysWithoutShipment(b.data) -
      daysWithoutShipment(a.data)
  );

  tableBody.innerHTML = sorted.map(item => {
    const days = daysWithoutShipment(item.data);
    const status = statusFromDays(days);

    return `
      <tr>
        <td>${item.cliente || "-"}</td>
        <td>${item.contrato || "-"}</td>
        <td>${item.obra || "-"}</td>
        <td>${item.volume || 0}</td>
        <td>${item.data || "-"}</td>
        <td>${days} dias</td>
        <td><span class="badge ${status.css}">${status.text}</span></td>
      </tr>
    `;
  }).join("");

  recordsInfo.textContent =
    `Mostrando ${sorted.length} registros`;
}

function renderAll() {
  const data = filteredData();
  updateSummary(data);
  renderTable(data);
}

/* ===========================
   IMPORTAÇÃO XLSX REAL
=========================== */

async function readSelectedFile() {
  const file = fileInput.files?.[0];
  if (!file) {
    statusMsg.textContent = "Selecione um arquivo.";
    return;
  }

  fileName.textContent = file.name;
  statusMsg.textContent = "Carregando...";

  const reader = new FileReader();

  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    rawData = json
      .filter(row =>
        row["Contrato"] ||
        row["contrato"] ||
        row["Cliente"] ||
        row["cliente"]
      )
      .map(row => ({
        contrato: row["Contrato"] || row["contrato"] || "",
        cliente: row["Cliente"] || row["cliente"] || "",
        obra: row["Nome da obra"] || row["obra"] || "",
        volume: row["Volume da obra"] || row["volume"] || 0,
        data: row["Data da remessa"] || row["data"] || ""
      }));

    populateFilters(rawData);
    renderAll();

    statusMsg.textContent =
      `Arquivo carregado. Total linhas: ${rawData.length}`;
  };

  reader.readAsArrayBuffer(file);
}

/* ===========================
   EVENTOS
=========================== */

document
  .getElementById("loadFileBtn")
  .addEventListener("click", readSelectedFile);

document
  .getElementById("clearBtn")
  .addEventListener("click", () => {
    rawData = [];
    renderAll();
    statusMsg.textContent = "Dados removidos.";
  });

yearFilter.addEventListener("change", renderAll);
monthFilter.addEventListener("change", renderAll);

/* IMPORTANTE: NÃO CARREGA DEMO AUTOMÁTICO */
