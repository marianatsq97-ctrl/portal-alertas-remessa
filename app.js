/* Portal de Alertas – Remessas
   - Importa XLSX no navegador (SheetJS)
   - Salva dados no localStorage (não some ao atualizar)
   - Tabela com filtro no cabeçalho por coluna
   - Visualização com cards + gráfico (Chart.js)
*/

const STORAGE_KEY = "pa_remessas_v1";

const screens = {
  home: document.getElementById("screen-home"),
  view: document.getElementById("screen-view"),
  data: document.getElementById("screen-data"),
};

const btnGoView = document.getElementById("btn-go-view");
const btnGoData = document.getElementById("btn-go-data");
const btnBackFromView = document.getElementById("btn-back-from-view");
const btnBackFromData = document.getElementById("btn-back-from-data");

const fileInput = document.getElementById("file-input");
const fileNameEl = document.getElementById("file-name");
const fileSubEl = document.getElementById("file-sub");
const btnClear = document.getElementById("btn-clear");
const btnLoadDemo = document.getElementById("btn-load-demo");

const thead = document.getElementById("thead");
const tbody = document.getElementById("tbody");
const rowCount = document.getElementById("row-count");

const quickStatus = document.getElementById("quick-status");
const quickDateMin = document.getElementById("quick-date-min");
const btnClearFilters = document.getElementById("btn-clear-filters");

const loading = document.getElementById("loading");
const loadingSub = document.getElementById("loading-sub");

const statusCards = document.getElementById("status-cards");
const fYear = document.getElementById("f-year");
const fMonth = document.getElementById("f-month");
const btnRefreshChart = document.getElementById("btn-refresh-chart");
const viewMeta = document.getElementById("view-meta");

const filterPop = document.getElementById("filter-pop");
const overlay = document.getElementById("overlay");
const filterTitle = document.getElementById("filter-title");
const filterSubtitle = document.getElementById("filter-subtitle");
const filterSearch = document.getElementById("filter-search");
const filterList = document.getElementById("filter-list");
const filterClose = document.getElementById("filter-close");
const filterCancel = document.getElementById("filter-cancel");
const filterApply = document.getElementById("filter-apply");
const filterAll = document.getElementById("filter-all");
const filterNone = document.getElementById("filter-none");

let chart = null;

const COLS = [
  { key: "cliente", label: "Cliente" },
  { key: "contrato", label: "Contrato" },
  { key: "vendedor", label: "Vendedor" },
  { key: "traco", label: "Traço" },
  { key: "material", label: "Material" },
  { key: "ultimaRemessa", label: "Última remessa" },
  { key: "quantidade", label: "Quantidade" },
  { key: "diasSemRemessa", label: "Dias sem remessa" },
  { key: "status", label: "Status" },
];

const state = {
  meta: null,         // { filename, loadedAtISO, rowsRaw, rowsAgg }
  rowsAgg: [],        // linhas agregadas (uma por chave)
  filters: {
    quickStatus: "",
    quickDateMin: "", // yyyy-mm-dd
    colFilters: {},   // key -> Set(values)
  },
  ui: {
    currentScreen: "home",
    openFilterKey: null,
    openFilterValues: [],
    openFilterChecked: new Set(),
    openFilterSearch: "",
  },
};

function showLoading(msg = "Lendo XLSX e calculando alertas") {
  loadingSub.textContent = msg;
  loading.classList.add("show");
}
function hideLoading() {
  loading.classList.remove("show");
}

function switchScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[name].classList.add("active");
  state.ui.currentScreen = name;
}

btnGoView.addEventListener("click", () => switchScreen("view"));
btnGoData.addEventListener("click", () => switchScreen("data"));
btnBackFromView.addEventListener("click", () => switchScreen("home"));
btnBackFromData.addEventListener("click", () => switchScreen("home"));

btnClear.addEventListener("click", () => {
  clearStoredData();
  fileInput.value = "";
  renderAll();
});

btnLoadDemo.addEventListener("click", async () => {
  try {
    showLoading("Carregando demo…");
    const res = await fetch("./data/demo.json", { cache: "no-store" });
    const demo = await res.json();

    // demo já vem no formato agregado esperado
    state.meta = {
      filename: "demo.json",
      loadedAtISO: new Date().toISOString(),
      rowsRaw: demo.length,
      rowsAgg: demo.length,
    };
    state.rowsAgg = demo.map(normalizeAggRow);

    saveToStorage();
    renderAll();
    switchScreen("data");
  } catch (e) {
    alert("Falha ao carregar demo.json. Veja se existe /data/demo.json no repo.");
  } finally {
    hideLoading();
  }
});

fileInput.addEventListener("change", async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;

  await importXlsxFile(file);
});

quickStatus.addEventListener("change", () => {
  state.filters.quickStatus = quickStatus.value || "";
  renderTable();
  renderCardsAndChart();
});

quickDateMin.addEventListener("change", () => {
  state.filters.quickDateMin = quickDateMin.value || "";
  renderTable();
  renderCardsAndChart();
});

btnClearFilters.addEventListener("click", () => {
  state.filters.quickStatus = "";
  state.filters.quickDateMin = "";
  state.filters.colFilters = {};
  quickStatus.value = "";
  quickDateMin.value = "";
  renderAll();
});

btnRefreshChart.addEventListener("click", () => {
  renderCardsAndChart();
});

/* ---------------------------
   Import XLSX
--------------------------- */

async function importXlsxFile(file) {
  try {
    showLoading("Abrindo XLSX…");

    fileNameEl.textContent = file.name;
    fileSubEl.textContent = `Tamanho: ${formatBytes(file.size)} • Importando…`;

    const arrayBuffer = await file.arrayBuffer();

    if (!window.XLSX) {
      alert("A lib XLSX não carregou. Verifica sua internet e recarrega a página.");
      return;
    }

    // Lê workbook
    const wb = XLSX.read(arrayBuffer, {
      type: "array",
      cellDates: true,
      raw: true,
    });

    const sheetName = wb.SheetNames?.[0];
    if (!sheetName) {
      alert("Esse XLSX parece vazio.");
      return;
    }

    showLoading("Lendo planilha e detectando colunas…");

    const ws = wb.Sheets[sheetName];
    // header:1 => retorna matriz [ [col1,col2,...], [row1...], ... ]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    if (!rows || rows.length < 2) {
      alert("Não achei linhas suficientes nessa planilha.");
      return;
    }

    const headerRowIndex = findHeaderRowIndex(rows);
    const header = rows[headerRowIndex].map(h => String(h ?? "").trim());
    const dataRows = rows.slice(headerRowIndex + 1);

    const colMap = buildColumnMap(header);

    // Se nem cliente e data aparecerem, não tem como.
    if (!colMap.cliente || !colMap.dataRemessa) {
      console.warn("Header detectado:", header);
      console.warn("Map detectado:", colMap);
      alert(
        "Não consegui reconhecer as colunas 'Cliente' e 'Data da remessa'.\n\n" +
        "Solução rápida: abre o SQL42.xlsx e garante que existe um cabeçalho com algo tipo:\n" +
        "CLIENTE | DATA REMESSA | MATERIAL | QUANTIDADE | CONTRATO | VENDEDOR | TRAÇO\n\n" +
        "Depois salva e importa de novo."
      );
      return;
    }

    showLoading("Convertendo linhas…");

    const raw = dataRows
      .filter(r => r && r.some(cell => String(cell ?? "").trim() !== ""))
      .map(r => parseRawRow(r, colMap));

    // Remove linhas sem cliente OU sem data
    const rawClean = raw.filter(r => r.cliente && r.dataRemessa);

    showLoading("Agregando por cliente + (contrato/vendedor/traço/material)…");

    const agg = aggregateRows(rawClean);

    state.meta = {
      filename: file.name,
      loadedAtISO: new Date().toISOString(),
      rowsRaw: rawClean.length,
      rowsAgg: agg.length,
    };
    state.rowsAgg = agg.map(normalizeAggRow);

    saveToStorage();
    fileSubEl.textContent = `Importado: ${rawClean.length} linhas • Consolidado: ${agg.length} registros`;

    renderAll();
    switchScreen("data");
  } catch (err) {
    console.error(err);
    alert("Deu ruim importando o XLSX. Abre o console (F12) e me manda o erro.");
  } finally {
    hideLoading();
  }
}

function findHeaderRowIndex(rows) {
  // Procura a primeira linha que contenha "cliente" e alguma "data"
  // (a planilha pode ter 1-5 linhas de título antes)
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i].map(v => normalizeKey(String(v ?? "")));
    const hasCliente = row.some(v => v.includes("cliente"));
    const hasData = row.some(v => v.includes("data"));
    if (hasCliente && hasData) return i;
  }
  return 0; // fallback
}

function buildColumnMap(header) {
  // tenta reconhecer por apelidos
  const map = {
    cliente: null,
    dataRemessa: null,
    contrato: null,
    vendedor: null,
    traco: null,
    material: null,
    quantidade: null,
  };

  const keys = header.map(h => normalizeKey(h));

  function findIndex(predList) {
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      for (const p of predList) {
        if (k.includes(p)) return i;
      }
    }
    return null;
  }

  map.cliente = findIndex(["cliente", "razao social", "razão social", "destinatario", "destinatário"]);
  map.dataRemessa = findIndex(["data remessa", "dt remessa", "data de remessa", "emissao", "emissão", "data", "dt"]);
  map.contrato = findIndex(["contrato", "ctto", "n contrato", "numero contrato", "nº contrato"]);
  map.vendedor = findIndex(["vendedor", "vend", "representante", "consultor"]);
  map.traco = findIndex(["traco", "traço", "traco concreto", "traço concreto", "traco/traço"]);
  map.material = findIndex(["material", "produto", "item", "descricao", "descrição"]);
  map.quantidade = findIndex(["quantidade", "qtd", "qtde", "volume", "m3", "peso"]);

  // Se "data" pegou errado (tipo "data cadastro") ainda assim vai vir, mas a validação pega no parse
  return map;
}

function parseRawRow(rowArr, colMap) {
  const get = (idx) => (idx === null || idx === undefined ? "" : rowArr[idx]);

  const cliente = String(get(colMap.cliente) ?? "").trim();

  const dataVal = get(colMap.dataRemessa);
  const dataRemessa = parseAnyDate(dataVal);

  const contrato = String(get(colMap.contrato) ?? "").trim();
  const vendedor = String(get(colMap.vendedor) ?? "").trim();
  const traco = String(get(colMap.traco) ?? "").trim();
  const material = String(get(colMap.material) ?? "").trim();

  const qtdVal = get(colMap.quantidade);
  const quantidade = parseNumber(qtdVal);

  return { cliente, dataRemessa, contrato, vendedor, traco, material, quantidade };
}

function parseAnyDate(v) {
  if (v === null || v === undefined || v === "") return null;

  // Date object
  if (v instanceof Date && !isNaN(v.getTime())) {
    return stripTime(v);
  }

  // Excel serial number
  if (typeof v === "number" && isFinite(v)) {
    // Excel epoch: 1899-12-30
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return stripTime(d);
  }

  const s = String(v).trim();
  if (!s) return null;

  // dd/mm/yyyy
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    let yy = Number(m[3]);
    if (yy < 100) yy += 2000;
    const d = new Date(yy, mm - 1, dd);
    if (!isNaN(d.getTime())) return stripTime(d);
  }

  // yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!isNaN(d.getTime())) return stripTime(d);
  }

  // Fallback Date.parse
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) return stripTime(d2);

  return null;
}

function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && isFinite(v)) return v;

  const s = String(v).trim();
  if (!s) return null;

  // 1.234,56 -> 1234.56
  const normalized = s
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.\-]/g, "");

  const n = Number(normalized);
  return isFinite(n) ? n : null;
}

/* ---------------------------
   Agregação e Status
--------------------------- */

function aggregateRows(rows) {
  // chave: cliente + contrato + vendedor + traco + material
  // (se alguma info vier vazia, ok — mas mantém a chave)
  const map = new Map();

  for (const r of rows) {
    const key = [
      r.cliente || "",
      r.contrato || "",
      r.vendedor || "",
      r.traco || "",
      r.material || "",
    ].join("||");

    const curr = map.get(key);
    if (!curr) {
      map.set(key, { ...r });
    } else {
      // Mantém a maior dataRemessa como "última"
      if (r.dataRemessa && (!curr.dataRemessa || r.dataRemessa > curr.dataRemessa)) {
        curr.dataRemessa = r.dataRemessa;
        curr.quantidade = r.quantidade ?? curr.quantidade;
      } else if (r.dataRemessa && curr.dataRemessa && r.dataRemessa.getTime() === curr.dataRemessa.getTime()) {
        // mesma data: soma quantidade se tiver
        if (isFiniteNumber(curr.quantidade) && isFiniteNumber(r.quantidade)) curr.quantidade += r.quantidade;
        else if (!isFiniteNumber(curr.quantidade) && isFiniteNumber(r.quantidade)) curr.quantidade = r.quantidade;
      }
    }
  }

  // transforma em formato de tabela (com cálculo de dias/status)
  const today = stripTime(new Date());
  const out = [];

  for (const v of map.values()) {
    const ultima = v.dataRemessa ? stripTime(v.dataRemessa) : null;
    const dias = ultima ? diffDays(ultima, today) : null;

    const status = calcStatus(dias);

    out.push({
      cliente: v.cliente || "-",
      contrato: v.contrato || "-",
      vendedor: v.vendedor || "-",
      traco: v.traco || "-",
      material: v.material || "-",
      ultimaRemessa: ultima,
      quantidade: isFiniteNumber(v.quantidade) ? v.quantidade : null,
      diasSemRemessa: dias,
      status,
    });
  }

  // Ordena: pior primeiro (Plano de ação > Atenção > OK), depois mais dias
  out.sort((a, b) => {
    const wA = statusWeight(a.status);
    const wB = statusWeight(b.status);
    if (wA !== wB) return wB - wA;
    return (b.diasSemRemessa ?? -1) - (a.diasSemRemessa ?? -1);
  });

  return out;
}

function calcStatus(dias) {
  // regra raiz
  if (dias === null || dias === undefined) return "Sem data";
  if (dias <= 4) return "OK";
  if (dias <= 7) return "Atenção";
  return "Plano de ação";
}

function statusWeight(s) {
  if (s === "Plano de ação") return 3;
  if (s === "Atenção") return 2;
  if (s === "OK") return 1;
  return 0;
}

function diffDays(a, b) {
  const ms = stripTime(b).getTime() - stripTime(a).getTime();
  return Math.floor(ms / 86400000);
}

function isFiniteNumber(n) {
  return typeof n === "number" && isFinite(n);
}

function normalizeAggRow(r) {
  // garante tipos consistentes (especialmente data, quando vem do storage)
  const ultima = r.ultimaRemessa ? new Date(r.ultimaRemessa) : null;
  return {
    ...r,
    ultimaRemessa: ultima && !isNaN(ultima.getTime()) ? stripTime(ultima) : null,
    diasSemRemessa: r.diasSemRemessa === null || r.diasSemRemessa === undefined ? null : Number(r.diasSemRemessa),
    quantidade: r.quantidade === null || r.quantidade === undefined ? null : Number(r.quantidade),
  };
}

/* ---------------------------
   Render
--------------------------- */

function renderAll() {
  renderMeta();
  renderTable();
  renderCardsAndChart();
  buildChartFilters();
}

function renderMeta() {
  if (!state.meta) {
    fileNameEl.textContent = "Nenhum arquivo carregado";
    fileSubEl.textContent = "Importe o SQL42.xlsx na aba Dados.";
    return;
  }
  fileNameEl.textContent = state.meta.filename;
  fileSubEl.textContent = `Carregado em: ${formatDateTime(state.meta.loadedAtISO)} • Linhas: ${state.meta.rowsRaw} • Consolidado: ${state.meta.rowsAgg}`;
}

function renderTable() {
  const rows = getFilteredRows();

  // Cabeçalho com filtro em cada coluna
  thead.innerHTML = "";
  const tr = document.createElement("tr");

  for (const c of COLS) {
    const th = document.createElement("th");
    const wrap = document.createElement("div");
    wrap.className = "th-wrap";

    const left = document.createElement("div");
    left.className = "th-title";
    left.textContent = c.label;

    const btn = document.createElement("button");
    btn.className = "th-filter";
    btn.textContent = "▾";
    btn.title = `Filtrar ${c.label}`;
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openColumnFilter(c.key, c.label);
    });

    wrap.appendChild(left);
    wrap.appendChild(btn);
    th.appendChild(wrap);
    tr.appendChild(th);
  }

  thead.appendChild(tr);

  // Body
  tbody.innerHTML = "";

  for (const r of rows) {
    const trb = document.createElement("tr");

    for (const c of COLS) {
      const td = document.createElement("td");

      if (c.key === "ultimaRemessa") {
        td.textContent = r.ultimaRemessa ? formatDateBR(r.ultimaRemessa) : "-";
      } else if (c.key === "quantidade") {
        td.textContent = isFiniteNumber(r.quantidade) ? formatNumber(r.quantidade) : "-";
      } else if (c.key === "diasSemRemessa") {
        td.textContent = r.diasSemRemessa === null || r.diasSemRemessa === undefined ? "-" : String(r.diasSemRemessa);
      } else if (c.key === "status") {
        td.appendChild(renderStatusBadge(r.status));
      } else {
        td.textContent = String(r[c.key] ?? "-");
      }

      trb.appendChild(td);
    }

    tbody.appendChild(trb);
  }

  rowCount.textContent = `Registros exibidos: ${rows.length}`;
}

function renderStatusBadge(status) {
  const span = document.createElement("span");
  span.className = "badge";

  const dot = document.createElement("span");
  dot.className = "dot";

  if (status === "OK") span.classList.add("ok");
  else if (status === "Atenção") span.classList.add("warn");
  else if (status === "Plano de ação") span.classList.add("bad");
  else span.classList.add("warn");

  span.appendChild(dot);
  span.appendChild(document.createTextNode(status));
  return span;
}

function renderCardsAndChart() {
  const rows = getFilteredRows();

  // Cards
  const counts = { ok: 0, warn: 0, bad: 0 };
  for (const r of rows) {
    if (r.status === "OK") counts.ok++;
    else if (r.status === "Atenção") counts.warn++;
    else if (r.status === "Plano de ação") counts.bad++;
  }

  statusCards.innerHTML = `
    <div class="card">
      <h4>OK</h4>
      <div class="big">${counts.ok}</div>
      <div class="small">0–4 dias sem remessa</div>
    </div>
    <div class="card warn">
      <h4>Atenção</h4>
      <div class="big">${counts.warn}</div>
      <div class="small">5–7 dias sem remessa</div>
    </div>
    <div class="card bad">
      <h4>Plano de ação</h4>
      <div class="big">${counts.bad}</div>
      <div class="small">> 7 dias sem remessa</div>
    </div>
  `;

  // Chart data: evolução (contagem de últimas remessas por dia)
  const { labels, values } = buildChartSeries(rows);

  viewMeta.textContent = state.meta
    ? `Fonte: ${state.meta.filename} • consolidado: ${state.meta.rowsAgg} • exibindo: ${rows.length}`
    : "Sem dados carregados. Vá na aba Dados e importe o SQL42.xlsx.";

  // (re)draw
  const ctx = document.getElementById("chartRemessas");
  if (!ctx || !window.Chart) return;

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Qtde de remessas (última remessa por registro)",
          data: values,
          borderWidth: 0,
          borderRadius: 6,
          barThickness: 10, // colunas finas
          maxBarThickness: 14,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#ddd" } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} remessas`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#bbb", maxRotation: 0, autoSkip: true },
          grid: { color: "rgba(255,255,255,0.06)" },
        },
        y: {
          ticks: { color: "#bbb" },
          grid: { color: "rgba(255,255,255,0.06)" },
        },
      },
    },
  });
}

function buildChartFilters() {
  // popula ano/mês baseado nos dados
  const rows = state.rowsAgg || [];
  const dates = rows
    .map(r => r.ultimaRemessa)
    .filter(d => d instanceof Date && !isNaN(d.getTime()));

  const years = Array.from(new Set(dates.map(d => d.getFullYear()))).sort((a,b)=>a-b);

  fYear.innerHTML = `<option value="">Todos</option>` + years.map(y => `<option value="${y}">${y}</option>`).join("");

  fMonth.innerHTML =
    `<option value="">Todos</option>` +
    Array.from({ length: 12 }, (_, i) => i + 1)
      .map(m => `<option value="${m}">${String(m).padStart(2, "0")}</option>`)
      .join("");

  // default: ano atual se existir
  const nowY = new Date().getFullYear();
  if (years.includes(nowY) && !fYear.value) fYear.value = String(nowY);
}

function buildChartSeries(rows) {
  // Aplica filtros do gráfico: ano/mês
  const y = fYear.value ? Number(fYear.value) : null;
  const m = fMonth.value ? Number(fMonth.value) : null;

  const filtered = rows.filter(r => {
    if (!(r.ultimaRemessa instanceof Date) || isNaN(r.ultimaRemessa.getTime())) return false;
    if (y !== null && r.ultimaRemessa.getFullYear() !== y) return false;
    if (m !== null && (r.ultimaRemessa.getMonth() + 1) !== m) return false;
    return true;
  });

  // conta por dia
  const map = new Map();
  for (const r of filtered) {
    const k = formatDateISO(r.ultimaRemessa); // yyyy-mm-dd
    map.set(k, (map.get(k) || 0) + 1);
  }

  const labelsIso = Array.from(map.keys()).sort();
  const labels = labelsIso.map(iso => isoToBR(iso));
  const values = labelsIso.map(k => map.get(k));

  // Se vazio, mantém algo pra não ficar “quebrado”
  if (labels.length === 0) {
    return { labels: ["Sem dados no filtro"], values: [0] };
  }

  return { labels, values };
}

/* ---------------------------
   Filtros (quick + por coluna)
--------------------------- */

function getFilteredRows() {
  let rows = [...(state.rowsAgg || [])];

  // quick status
  if (state.filters.quickStatus) {
    rows = rows.filter(r => r.status === state.filters.quickStatus);
  }

  // quick date min (ultimaRemessa)
  if (state.filters.quickDateMin) {
    const min = new Date(state.filters.quickDateMin + "T00:00:00");
    rows = rows.filter(r => r.ultimaRemessa && r.ultimaRemessa >= min);
  }

  // filtros por coluna
  for (const [key, set] of Object.entries(state.filters.colFilters)) {
    if (!set || set.size === 0) continue;
    rows = rows.filter(r => {
      const v = getCellValueForFilter(r, key);
      return set.has(v);
    });
  }

  return rows;
}

function getCellValueForFilter(r, key) {
  if (key === "ultimaRemessa") return r.ultimaRemessa ? formatDateBR(r.ultimaRemessa) : "-";
  if (key === "quantidade") return isFiniteNumber(r.quantidade) ? formatNumber(r.quantidade) : "-";
  if (key === "diasSemRemessa") return r.diasSemRemessa === null || r.diasSemRemessa === undefined ? "-" : String(r.diasSemRemessa);
  return String(r[key] ?? "-");
}

function openColumnFilter(key, label) {
  const rows = state.rowsAgg || [];
  const values = Array.from(new Set(rows.map(r => getCellValueForFilter(r, key)))).sort((a,b)=>String(a).localeCompare(String(b)));

  state.ui.openFilterKey = key;
  state.ui.openFilterValues = values;

  const currentSet = state.filters.colFilters[key] || new Set(values);
  state.ui.openFilterChecked = new Set(currentSet);

  filterTitle.textContent = `Filtrar: ${label}`;
  filterSubtitle.textContent = `${values.length} valores encontrados`;
  filterSearch.value = "";
  state.ui.openFilterSearch = "";

  buildFilterList();

  overlay.classList.remove("hidden");
  filterPop.classList.remove("hidden");
}

function closeColumnFilter() {
  state.ui.openFilterKey = null;
  state.ui.openFilterValues = [];
  state.ui.openFilterChecked = new Set();
  state.ui.openFilterSearch = "";
  filterList.innerHTML = "";

  overlay.classList.add("hidden");
  filterPop.classList.add("hidden");
}

function buildFilterList() {
  const values = state.ui.openFilterValues || [];
  const q = (filterSearch.value || "").trim().toLowerCase();

  const filtered = q
    ? values.filter(v => String(v).toLowerCase().includes(q))
    : values;

  filterList.innerHTML = "";

  for (const v of filtered) {
    const row = document.createElement("label");
    row.className = "check";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = state.ui.openFilterChecked.has(v);
    cb.addEventListener("change", () => {
      if (cb.checked) state.ui.openFilterChecked.add(v);
      else state.ui.openFilterChecked.delete(v);
    });

    const span = document.createElement("span");
    span.textContent = String(v);

    row.appendChild(cb);
    row.appendChild(span);
    filterList.appendChild(row);
  }
}

filterSearch.addEventListener("input", () => buildFilterList());
filterClose.addEventListener("click", () => closeColumnFilter());
filterCancel.addEventListener("click", () => closeColumnFilter());
overlay.addEventListener("click", () => closeColumnFilter());

filterAll.addEventListener("click", () => {
  state.ui.openFilterChecked = new Set(state.ui.openFilterValues);
  buildFilterList();
});

filterNone.addEventListener("click", () => {
  state.ui.openFilterChecked = new Set();
  buildFilterList();
});

filterApply.addEventListener("click", () => {
  const key = state.ui.openFilterKey;
  if (!key) return;

  // Se o user desmarcou tudo, a coluna vira "sem resultado", então:
  // - se marcou tudo, remove filtro
  // - se marcou nada, cria filtro vazio (vai dar 0 linhas) — é o comportamento esperado
  const all = state.ui.openFilterValues;
  const set = state.ui.openFilterChecked;

  const isAllSelected = set.size === all.length;
  if (isAllSelected) {
    delete state.filters.colFilters[key];
  } else {
    state.filters.colFilters[key] = new Set(set);
  }

  closeColumnFilter();
  renderAll();
});

document.addEventListener("click", () => {
  // fecha popup caso clique fora
  if (!filterPop.classList.contains("hidden")) closeColumnFilter();
});

/* ---------------------------
   Storage
--------------------------- */

function saveToStorage() {
  const payload = {
    meta: state.meta,
    rowsAgg: state.rowsAgg.map(r => ({
      ...r,
      ultimaRemessa: r.ultimaRemessa ? r.ultimaRemessa.toISOString() : null,
    })),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !data.rowsAgg) return false;

    state.meta = data.meta || null;
    state.rowsAgg = (data.rowsAgg || []).map(normalizeAggRow);
    return true;
  } catch {
    return false;
  }
}

function clearStoredData() {
  localStorage.removeItem(STORAGE_KEY);
  state.meta = null;
  state.rowsAgg = [];
  state.filters = { quickStatus: "", quickDateMin: "", colFilters: {} };
  quickStatus.value = "";
  quickDateMin.value = "";
  fileNameEl.textContent = "Nenhum arquivo carregado";
  fileSubEl.textContent = "Importe o SQL42.xlsx na aba Dados.";
}

/* ---------------------------
   Utils
--------------------------- */

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B","KB","MB","GB"];
  const i = Math.floor(Math.log(bytes)/Math.log(k));
  return `${(bytes/Math.pow(k,i)).toFixed(1)} ${sizes[i]}`;
}

function formatDateBR(d) {
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function formatDateISO(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yy}-${mm}-${dd}`;
}

function isoToBR(iso) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatDateTime(iso) {
  try {
    const d = new Date(iso);
    return `${formatDateBR(d)} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  } catch {
    return iso;
  }
}

function formatNumber(n) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);
}

function normalizeKey(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------------------------
   Boot
--------------------------- */

(function boot() {
  const has = loadFromStorage();
  renderAll();
  // se já tem dados, manda pro home mesmo; você escolhe pra onde ir
  switchScreen("home");

  if (has) {
    fileSubEl.textContent = `Restaurado do navegador • ${state.meta?.filename || ""}`;
  }
})();
