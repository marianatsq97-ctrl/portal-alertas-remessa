/* =========================================================
   PORTAL DE ALERTAS – REMESSAS (completo)
   - Persistência localStorage (arquivo não some)
   - Consolidação por CONTRATO (não cliente único)
   - Status 4 níveis com cores oficiais
   - Filtros inteligentes (busca, status, ano, mês, agregados)
   - Resumo + gráfico + tabela atualizam em tempo real
   - "Carregar todos" limpa filtros
   - Card de status abre histórico completo
   ========================================================= */

const STORAGE_KEY = "AA_REMESSAS_DATA_V1";
const STORAGE_META = "AA_REMESSAS_META_V1";
const SESSION_ADMIN = "AA_REMESSAS_IS_ADMIN";

const STATUS = {
  OK: { label: "OK", color: "#2ecc71", min: 0, max: 7, desc: "Situação normal" },
  ATENCAO: { label: "Atenção", color: "#f1c40f", min: 8, max: 14, desc: "Risco moderado" },
  GRAVE: { label: "Atenção Grave", color: "#e67e22", min: 15, max: 21, desc: "Risco alto" },
  ACAO: { label: "Plano de Ação", color: "#e74c3c", min: 22, max: Infinity, desc: "Ação imediata" },
};

const AGREGADOS_WHITELIST = [
  "areia", "brita", "pedrisco", "rachão", "bica corrida", "pó de pedra", "macadame"
];

// DOM
const el = {
  fBusca: document.getElementById("fBusca"),
  fStatus: document.getElementById("fStatus"),
  fAno: document.getElementById("fAno"),
  fMes: document.getElementById("fMes"),
  fAgregado: document.getElementById("fAgregado"),

  hintFonte: document.getElementById("hintFonte"),
  hintRegistros: document.getElementById("hintRegistros"),

  cardsResumo: document.getElementById("cardsResumo"),
  tbody: document.getElementById("tbody"),

  chart: document.getElementById("chartEvolucao"),

  panelImport: document.getElementById("panelImport"),
  adminPass: document.getElementById("adminPass"),
  fileInput: document.getElementById("fileInput"),
  btnImportar: document.getElementById("btnImportar"),
  btnExcluirArquivo: document.getElementById("btnExcluirArquivo"),

  btnDemo: document.getElementById("btnDemo"),
  btnCarregarTodos: document.getElementById("btnCarregarTodos"),

  modalBackdrop: document.getElementById("modalBackdrop"),
  modalTitle: document.getElementById("modalTitle"),
  modalSubtitle: document.getElementById("modalSubtitle"),
  modalBody: document.getElementById("modalBody"),
  btnFecharModal: document.getElementById("btnFecharModal"),
};

let rawRows = [];
let consolidated = []; // contratos consolidados
let chartInstance = null;

// --------- util datas ---------
function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}
function pad2(n){ return String(n).padStart(2,"0"); }

function toDate(value) {
  // Excel serial
  if (typeof value === "number" && value > 20000 && value < 60000) {
    const utc = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(utc);
    return isValidDate(d) ? d : null;
  }

  // já Date
  if (value instanceof Date) return isValidDate(value) ? value : null;

  // string dd/mm/yyyy ou yyyy-mm-dd
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;

    // dd/mm/yyyy
    const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (br) {
      const dd = Number(br[1]);
      const mm = Number(br[2]) - 1;
      const yy = Number(br[3].length === 2 ? "20"+br[3] : br[3]);
      const d = new Date(yy, mm, dd);
      return isValidDate(d) ? d : null;
    }

    // yyyy-mm-dd
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
      const yy = Number(iso[1]);
      const mm = Number(iso[2]) - 1;
      const dd = Number(iso[3]);
      const d = new Date(yy, mm, dd);
      return isValidDate(d) ? d : null;
    }

    // fallback Date.parse
    const d2 = new Date(s);
    return isValidDate(d2) ? d2 : null;
  }

  return null;
}

function fmtDate(d){
  if(!d) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
}

function monthKey(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`; // YYYY-MM
}
function monthLabelFromKey(k){
  const [y,m] = k.split("-");
  return `${m}/${y}`; // MM/YYYY (sem data completa)
}

function diffDays(fromDate, toDate = new Date()){
  const ms = toDate.getTime() - fromDate.getTime();
  return Math.floor(ms / 86400000);
}

// --------- status ---------
function statusByDays(days){
  if (days <= 7) return STATUS.OK;
  if (days <= 14) return STATUS.ATENCAO;
  if (days <= 21) return STATUS.GRAVE;
  return STATUS.ACAO;
}

// --------- “tempo” inteligente (leitura estratégica) ---------
function prettyAge(days){
  if (days > 365) {
    const years = Math.floor(days / 365);
    return `${years} ano${years>1?"s":""}`;
  }
  if (days > 31) {
    const months = Math.floor(days / 30);
    return `${months} mês${months>1?"es":""}`;
  }
  return `${days} dia${days!==1?"s":""}`;
}

// --------- normalização de colunas ---------
function norm(s){
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu,"")
    .replace(/\s+/g," ");
}

function pick(obj, keys){
  // tenta achar uma coluna por variações
  const map = {};
  for (const k of Object.keys(obj)) map[norm(k)] = k;

  for (const key of keys) {
    const nk = norm(key);
    if (map[nk] != null) return obj[map[nk]];
  }
  return "";
}

// --------- regra agregados ---------
function isAgregado(material){
  const m = norm(material);
  if (!m) return false;
  return AGREGADOS_WHITELIST.some(w => m.includes(w));
}

// --------- consolidação por contrato (CNPJ + Contrato + Traço + Material) ---------
function consolidateRows(rows){
  const byKey = new Map();

  for (const r of rows) {
    const cliente = String(pick(r, ["Cliente", "Nome do cliente", "Razao Social", "Razão Social", "Cliente Nome"]) || "").trim();
    const cnpj = String(pick(r, ["CNPJ", "Cnpj", "CPF/CNPJ", "Documento"]) || "").trim();
    const contrato = String(pick(r, ["Contrato", "Nº Contrato", "Numero do contrato", "N° Contrato"]) || "").trim();
    const vendedor = String(pick(r, ["Vendedor", "Representante", "Comercial"]) || "").trim();
    const traco = String(pick(r, ["Traço", "Traco", "Traço/Produto", "Produto", "Traco/Produto"]) || "").trim();
    const material = String(pick(r, ["Material", "Produto", "Descricao", "Descrição", "Item"]) || "").trim();

    const data = toDate(pick(r, ["Data da remessa", "Data Remessa", "Data", "Dt Remessa", "Ultima Remessa", "Última remessa"]));
    if (!data) continue;

    const qtdRaw = pick(r, ["Quantidade", "Qtde", "Qtd", "Volume", "Toneladas", "M3", "m3", "m³"]);
    const quantidade = (qtdRaw === "" || qtdRaw == null) ? 0 : Number(String(qtdRaw).replace(",", "."));

    const nomeObra = String(pick(r, ["Nome da obra", "Obra", "Obra Nome"]) || "").trim();
    const volumeObra = String(pick(r, ["Volume da obra", "Volume Obra", "Volume total", "Volume"]) || "").trim();

    const key = `${cnpj}||${contrato}||${traco}||${material}`;

    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        cliente, cnpj, contrato, vendedor, traco, material,
        ultimaRemessa: data,
        quantidadeTotal: Number.isFinite(quantidade) ? quantidade : 0,
        nomeObra,
        volumeObra,
      });
    } else {
      const cur = byKey.get(key);
      // mantém maior data como última remessa
      if (data > cur.ultimaRemessa) cur.ultimaRemessa = data;
      // soma quantidade (pra ter noção do volume consolidado)
      if (Number.isFinite(quantidade)) cur.quantidadeTotal += quantidade;
      // preenche obra/volume se estiver vazio
      if (!cur.nomeObra && nomeObra) cur.nomeObra = nomeObra;
      if (!cur.volumeObra && volumeObra) cur.volumeObra = volumeObra;
    }
  }

  const out = Array.from(byKey.values()).map(x => {
    const dias = diffDays(x.ultimaRemessa, new Date());
    const st = statusByDays(dias);
    return {
      ...x,
      diasSemRemessa: dias,
      tempoSemRemessa: prettyAge(dias),
      status: st.label,
      statusColor: st.color
    };
  });

  // ordem cronológica correta pela última remessa (mais antiga primeiro = mais crítico visualmente)
  out.sort((a,b) => a.ultimaRemessa - b.ultimaRemessa);
  return out;
}

// --------- filtro aplicado (tabela/resumo/grafico juntos) ---------
function applyFilters(data){
  const busca = norm(el.fBusca.value);
  const status = el.fStatus.value;
  const ano = el.fAno.value;
  const mes = el.fMes.value;
  const onlyAg = el.fAgregado.value === "1";

  return data.filter(r => {
    if (onlyAg && !isAgregado(r.material)) return false;

    if (status !== "__ALL__" && r.status !== status) return false;

    if (ano !== "__ALL__" || mes !== "__ALL__") {
      const y = String(r.ultimaRemessa.getFullYear());
      const m = pad2(r.ultimaRemessa.getMonth()+1);
      if (ano !== "__ALL__" && y !== ano) return false;
      if (mes !== "__ALL__" && m !== mes) return false;
    }

    if (busca) {
      const hay = norm([
        r.cliente, r.cnpj, r.contrato, r.vendedor, r.traco, r.material, r.status
      ].join(" "));
      if (!hay.includes(busca)) return false;
    }

    return true;
  });
}

// --------- UI: resumo ---------
function renderResumo(filtered){
  const counts = {
    "OK": 0,
    "Atenção": 0,
    "Atenção Grave": 0,
    "Plano de Ação": 0,
  };

  for (const r of filtered) counts[r.status]++;

  const cards = [
    {
      label: "OK",
      color: STATUS.OK.color,
      desc: "0 a 7 dias sem remessa",
      value: counts["OK"]
    },
    {
      label: "Atenção",
      color: STATUS.ATENCAO.color,
      desc: "7 a 14 dias sem remessa",
      value: counts["Atenção"]
    },
    {
      label: "Atenção Grave",
      color: STATUS.GRAVE.color,
      desc: "14 a 21 dias sem remessa",
      value: counts["Atenção Grave"]
    },
    {
      label: "Plano de Ação",
      color: STATUS.ACAO.color,
      desc: "> 21 dias sem remessa",
      value: counts["Plano de Ação"]
    },
  ];

  el.cardsResumo.innerHTML = cards.map(c => `
    <div class="card clickable" data-status="${c.label}" style="border-left-color:${c.color}">
      <div class="k">
        <b>${c.label}</b>
        <span>${c.desc}</span>
      </div>
      <div class="v">${c.value}</div>
    </div>
  `).join("");

  // click abre histórico
  for (const node of el.cardsResumo.querySelectorAll(".card.clickable")){
    node.addEventListener("click", () => {
      const st = node.getAttribute("data-status");
      openModalStatus(st);
    });
  }
}

// --------- UI: tabela ---------
function renderTabela(filtered){
  el.tbody.innerHTML = filtered.map(r => {
    const badge = `<span class="badge" style="background:${r.statusColor}">${r.status}</span>`;
    return `
      <tr>
        <td>${escapeHTML(r.cliente)}</td>
        <td>${escapeHTML(r.cnpj)}</td>
        <td>${escapeHTML(r.contrato)}</td>
        <td>${escapeHTML(r.vendedor)}</td>
        <td>${escapeHTML(r.traco)}</td>
        <td>${escapeHTML(r.material)}</td>
        <td>${fmtDate(r.ultimaRemessa)}</td>
        <td>${Number.isFinite(r.quantidadeTotal) ? r.quantidadeTotal.toFixed(2) : ""}</td>
        <td>${r.diasSemRemessa}</td>
        <td>${r.tempoSemRemessa}</td>
        <td>${escapeHTML(r.nomeObra || "")}</td>
        <td>${escapeHTML(r.volumeObra || "")}</td>
        <td>${badge}</td>
      </tr>
    `;
  }).join("");
}

// --------- UI: gráfico evolução (mês/ano + empilhado por status) ---------
function renderGrafico(filtered){
  // agrupa por mês/ano da última remessa
  const buckets = new Map(); // key -> {OK, Atenção, Grave, Ação}

  for (const r of filtered) {
    const k = monthKey(r.ultimaRemessa);
    if (!buckets.has(k)) {
      buckets.set(k, { OK:0, AT:0, GR:0, AC:0 });
    }
    const b = buckets.get(k);
    if (r.status === "OK") b.OK++;
    else if (r.status === "Atenção") b.AT++;
    else if (r.status === "Atenção Grave") b.GR++;
    else b.AC++;
  }

  const keys = Array.from(buckets.keys()).sort(); // cronológico
  const labels = keys.map(monthLabelFromKey);

  const ok = keys.map(k => buckets.get(k).OK);
  const at = keys.map(k => buckets.get(k).AT);
  const gr = keys.map(k => buckets.get(k).GR);
  const ac = keys.map(k => buckets.get(k).AC);

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(el.chart, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "OK", data: ok, backgroundColor: STATUS.OK.color, borderWidth: 0, barThickness: 14 },
        { label: "Atenção", data: at, backgroundColor: STATUS.ATENCAO.color, borderWidth: 0, barThickness: 14 },
        { label: "Atenção Grave", data: gr, backgroundColor: STATUS.GRAVE.color, borderWidth: 0, barThickness: 14 },
        { label: "Plano de Ação", data: ac, backgroundColor: STATUS.ACAO.color, borderWidth: 0, barThickness: 14 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#e8eaed" } },
        tooltip: { mode: "index", intersect: false },
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: "#a9b0bb" },
          grid: { color: "rgba(255,255,255,.06)" }
        },
        y: {
          stacked: true,
          ticks: { color: "#a9b0bb" },
          grid: { color: "rgba(255,255,255,.06)" }
        }
      }
    }
  });
}

// --------- filtros: ano/mês dinâmicos ---------
function rebuildAnoMesOptions(data){
  const months = new Set();
  const years = new Set();

  for (const r of data) {
    years.add(String(r.ultimaRemessa.getFullYear()));
    months.add(pad2(r.ultimaRemessa.getMonth()+1));
  }

  const yearsSorted = Array.from(years).sort((a,b)=>Number(a)-Number(b));
  const monthsSorted = Array.from(months).sort((a,b)=>Number(a)-Number(b));

  el.fAno.innerHTML = `<option value="__ALL__">Todos</option>` + yearsSorted.map(y => `<option value="${y}">${y}</option>`).join("");
  el.fMes.innerHTML = `<option value="__ALL__">Todos</option>` + monthsSorted.map(m => `<option value="${m}">${m}</option>`).join("");
}

// --------- render geral ---------
function renderAll(){
  consolidated = consolidateRows(rawRows);

  // options dependem da base inteira
  rebuildAnoMesOptions(consolidated);

  const filtered = applyFilters(consolidated);

  el.hintRegistros.textContent = `Registros exibidos: ${filtered.length}`;

  renderResumo(filtered);
  renderTabela(filtered);
  renderGrafico(filtered);
}

// --------- persistência ---------
function loadPersisted(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    rawRows = raw ? JSON.parse(raw) : [];
  }catch{
    rawRows = [];
  }

  try{
    const meta = localStorage.getItem(STORAGE_META);
    const m = meta ? JSON.parse(meta) : null;
    if (m?.fileName) el.hintFonte.textContent = `Fonte: ${m.fileName}`;
    else el.hintFonte.textContent = "Fonte: nenhuma";
  }catch{
    el.hintFonte.textContent = "Fonte: nenhuma";
  }
}

function savePersisted(fileName){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rawRows));
  localStorage.setItem(STORAGE_META, JSON.stringify({ fileName, savedAt: new Date().toISOString() }));
  el.hintFonte.textContent = `Fonte: ${fileName}`;
}

// --------- importação ---------
async function importFile(file){
  if (!file) return;

  const ext = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  let rows = [];

  if (ext.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(buffer);
    const wb = XLSX.read(text, { type: "string" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  } else {
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  }

  rawRows = rows;
  savePersisted(file.name);
  renderAll();
}

// --------- demo ---------
function loadDemo(){
  const today = new Date();
  function daysAgo(n){
    const d = new Date(today);
    d.setDate(d.getDate()-n);
    return fmtDate(d);
  }

  rawRows = [
    { Cliente:"Cliente A", CNPJ:"00.000.000/0001-00", Contrato:"C-101", Vendedor:"João", "Data da remessa": daysAgo(3), Material:"Areia", Quantidade: 12, "Nome da obra":"Obra 1", "Volume da obra":"120" },
    { Cliente:"Cliente A", CNPJ:"00.000.000/0001-00", Contrato:"C-101", Vendedor:"João", "Data da remessa": daysAgo(15), Material:"Areia", Quantidade: 8, "Nome da obra":"Obra 1", "Volume da obra":"120" },
    { Cliente:"Cliente B", CNPJ:"11.111.111/0001-11", Contrato:"C-202", Vendedor:"Maria", "Data da remessa": daysAgo(9), Material:"Brita", Quantidade: 20, "Nome da obra":"Obra 2", "Volume da obra":"300" },
    { Cliente:"Cliente C", CNPJ:"22.222.222/0001-22", Contrato:"C-303", Vendedor:"Pedro", "Data da remessa": daysAgo(18), Material:"Pedrisco", Quantidade: 5, "Nome da obra":"Obra 3", "Volume da obra":"90" },
    { Cliente:"Cliente D", CNPJ:"33.333.333/0001-33", Contrato:"C-404", Vendedor:"Ana", "Data da remessa": daysAgo(32), Material:"Rachão", Quantidade: 40, "Nome da obra":"Obra 4", "Volume da obra":"900" },
    { Cliente:"Cliente E", CNPJ:"44.444.444/0001-44", Contrato:"C-505", Vendedor:"Bruno", "Data da remessa": daysAgo(400), Material:"Pó de pedra", Quantidade: 15, "Nome da obra":"Obra 5", "Volume da obra":"1500" },
  ];

  savePersisted("DEMO");
  renderAll();
}

// --------- modal histórico ---------
function openModalStatus(statusLabel){
  const filtered = applyFilters(consolidated).filter(r => r.status === statusLabel);
  el.modalTitle.textContent = `Histórico – ${statusLabel}`;
  const st = {
    "OK": STATUS.OK,
    "Atenção": STATUS.ATENCAO,
    "Atenção Grave": STATUS.GRAVE,
    "Plano de Ação": STATUS.ACAO
  }[statusLabel];

  el.modalSubtitle.textContent = `${st.desc} • cor oficial aplicada • contratos: ${filtered.length}`;

  el.modalBody.innerHTML = filtered.map(r => `
    <tr>
      <td>${escapeHTML(r.cliente)}</td>
      <td>${escapeHTML(r.cnpj)}</td>
      <td>${escapeHTML(r.contrato)}</td>
      <td>${escapeHTML(r.material)}</td>
      <td>${fmtDate(r.ultimaRemessa)}</td>
      <td>${Number.isFinite(r.quantidadeTotal) ? r.quantidadeTotal.toFixed(2) : ""}</td>
      <td>${r.diasSemRemessa}</td>
      <td><span class="badge" style="background:${r.statusColor}">${r.status}</span></td>
    </tr>
  `).join("");

  el.modalBackdrop.classList.remove("hidden");
}

// --------- segurança por perfil (front only) ---------
function isAdmin(){
  return sessionStorage.getItem(SESSION_ADMIN) === "1";
}
function setAdmin(on){
  sessionStorage.setItem(SESSION_ADMIN, on ? "1" : "0");
  el.panelImport.style.display = on ? "block" : "none";
}

// senha simples (troca aqui)
const ADMIN_PASSWORD = "areiaana";

function applyAdminVisibility(){
  if (isAdmin()) {
    el.panelImport.style.display = "block";
  } else {
    el.panelImport.style.display = "none";
  }
}

// --------- escapes ---------
function escapeHTML(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// --------- eventos ---------
function wireEvents(){
  const rerender = () => {
    // quando filtra, atualiza tudo (resumo/gráfico/tabela) sem recarregar
    const filtered = applyFilters(consolidated);
    el.hintRegistros.textContent = `Registros exibidos: ${filtered.length}`;
    renderResumo(filtered);
    renderTabela(filtered);
    renderGrafico(filtered);
  };

  el.fBusca.addEventListener("input", rerender);
  el.fStatus.addEventListener("change", rerender);
  el.fAno.addEventListener("change", rerender);
  el.fMes.addEventListener("change", rerender);
  el.fAgregado.addEventListener("change", rerender);

  el.btnCarregarTodos.addEventListener("click", () => {
    el.fBusca.value = "";
    el.fStatus.value = "__ALL__";
    el.fAno.value = "__ALL__";
    el.fMes.value = "__ALL__";
    el.fAgregado.value = "1";
    rerender();
  });

  el.btnDemo.addEventListener("click", () => {
    loadDemo();
  });

  el.btnFecharModal.addEventListener("click", () => {
    el.modalBackdrop.classList.add("hidden");
  });
  el.modalBackdrop.addEventListener("click", (e) => {
    if (e.target === el.modalBackdrop) el.modalBackdrop.classList.add("hidden");
  });

  // admin pass (habilita importação)
  el.adminPass.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const ok = el.adminPass.value === ADMIN_PASSWORD;
      setAdmin(ok);
      el.adminPass.value = "";
    }
  });

  el.btnImportar.addEventListener("click", async () => {
    if (!isAdmin()) return;
    const file = el.fileInput.files?.[0];
    await importFile(file);
    el.fileInput.value = "";
  });

  el.btnExcluirArquivo.addEventListener("click", () => {
    if (!isAdmin()) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_META);
    rawRows = [];
    el.hintFonte.textContent = "Fonte: nenhuma";
    renderAll();
  });
}

// --------- init ---------
function init(){
  applyAdminVisibility();
  loadPersisted();
  wireEvents();

  // se não tem base, mantém vazia (sem travar)
  renderAll();

  // defaults
  el.fStatus.value = "__ALL__";
  el.fAgregado.value = "1";
}
init();
