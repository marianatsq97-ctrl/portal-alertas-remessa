let dados = [];
let grafico;

/* ===== ABAS ===== */
const tabResumo = document.getElementById("tabResumo");
const tabDados = document.getElementById("tabDados");
const resumo = document.getElementById("resumo");
const dadosTab = document.getElementById("dados");

tabResumo.onclick = () => {
  resumo.classList.remove("hidden");
  dadosTab.classList.add("hidden");
  tabResumo.classList.add("active");
  tabDados.classList.remove("active");
};

tabDados.onclick = () => {
  resumo.classList.add("hidden");
  dadosTab.classList.remove("hidden");
  tabResumo.classList.remove("active");
  tabDados.classList.add("active");
};

/* ===== IMPORTAÇÃO ===== */
document.getElementById("fileInput").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    const wb = XLSX.read(evt.target.result, { type: "binary" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    dados = XLSX.utils.sheet_to_json(sheet);

    salvarLocal();
    atualizarTudo();
  };
  reader.readAsBinaryString(file);
});

/* ===== STORAGE ===== */
function salvarLocal() {
  localStorage.setItem("dadosRemessa", JSON.stringify(dados));
}

function carregarLocal() {
  const salvo = localStorage.getItem("dadosRemessa");
  if (salvo) {
    dados = JSON.parse(salvo);
    atualizarTudo();
  }
}

function excluirArquivo() {
  localStorage.removeItem("dadosRemessa");
  dados = [];
  atualizarTudo();
}

/* ===== STATUS ===== */
function calcularStatus(dias) {
  if (dias <= 4) return "OK";
  if (dias <= 7) return "Atenção";
  return "Plano de ação";
}

/* ===== ATUALIZA TUDO ===== */
function atualizarTudo() {
  renderTabela(dados);
  atualizarResumo(dados);
  montarFiltros();
  atualizarGrafico();
}

/* ===== TABELA ===== */
function renderTabela(lista) {
  const tbody = document.getElementById("tabelaBody");
  tbody.innerHTML = "";

  lista.forEach(l => {
    const dias = Math.floor((new Date() - new Date(l["Data da remessa"])) / 86400000);
    const status = calcularStatus(dias);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${l.Cliente || "-"}</td>
      <td>${l.Contrato || "-"}</td>
      <td>${l.Vendedor || "-"}</td>
      <td>${l.Traço || "-"}</td>
      <td>${l.Material || "-"}</td>
      <td>${l["Data da remessa"] || "-"}</td>
      <td>${l.Quantidade || "-"}</td>
      <td>${dias}</td>
      <td class="status-${status.toLowerCase().replace(" ", "")}">${status}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ===== RESUMO ===== */
function atualizarResumo(lista) {
  let ok = 0, at = 0, pl = 0;

  lista.forEach(l => {
    const dias = Math.floor((new Date() - new Date(l["Data da remessa"])) / 86400000);
    const s = calcularStatus(dias);
    if (s === "OK") ok++;
    else if (s === "Atenção") at++;
    else pl++;
  });

  document.getElementById("countOk").innerText = ok;
  document.getElementById("countAtencao").innerText = at;
  document.getElementById("countPlano").innerText = pl;
}

/* ===== GRÁFICO ===== */
function atualizarGrafico() {
  const ctx = document.getElementById("grafico");

  const porMes = {};

  dados.forEach(l => {
    const d = new Date(l["Data da remessa"]);
    const key = `${d.getFullYear()}-${d.getMonth()+1}`;
    porMes[key] = (porMes[key] || 0) + 1;
  });

  const labels = Object.keys(porMes);
  const valores = Object.values(porMes);

  if (grafico) grafico.destroy();

  grafico = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Remessas",
        data: valores,
        backgroundColor: "#ff8c00"
      }]
    }
  });
}

/* ===== FILTRO STATUS ===== */
function filtrarStatus(status) {
  const filtrado = dados.filter(l => {
    const dias = Math.floor((new Date() - new Date(l["Data da remessa"])) / 86400000);
    return calcularStatus(dias) === status;
  });
  renderTabela(filtrado);
  atualizarResumo(filtrado);
}

/* ===== INIT ===== */
carregarLocal();
