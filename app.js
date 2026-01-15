let dados = [];

function abrir(painel) {
  document.getElementById("visualizacao").classList.add("oculto");
  document.getElementById("dados").classList.add("oculto");
  document.getElementById(painel).classList.remove("oculto");
}

document.getElementById("fileInput").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    const wb = XLSX.read(evt.target.result, { type: "binary" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);

    dados = json.map(l => tratarLinha(l));
    localStorage.setItem("sql42", JSON.stringify(dados));

    render();
  };
  reader.readAsBinaryString(file);
});

function tratarLinha(l) {
  const data = new Date(l["DATA DA REMESSA"]);
  const hoje = new Date();
  const dias = Math.floor((hoje - data) / 86400000);

  let status = "OK";
  if (dias > 7) status = "Plano de ação";
  else if (dias >= 5) status = "Atenção";

  return {
    cliente: l.CLIENTE || "-",
    contrato: l.CONTRATO || "-",
    vendedor: l.VENDEDOR || "-",
    traco: l.TRAÇO || "-",
    dataFmt: data.toLocaleDateString("pt-BR"),
    dias,
    status
  };
}

function render() {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  dados.forEach(l => {
    tbody.innerHTML += `
      <tr>
        <td>${l.cliente}</td>
        <td>${l.contrato}</td>
        <td>${l.vendedor}</td>
        <td>${l.traco}</td>
        <td>${l.dataFmt}</td>
        <td>${l.dias}</td>
        <td class="${l.status}">${l.status}</td>
      </tr>
    `;
  });

  document.getElementById("ok").innerText = dados.filter(d => d.status === "OK").length;
  document.getElementById("atencao").innerText = dados.filter(d => d.status === "Atenção").length;
  document.getElementById("plano").innerText = dados.filter(d => d.status === "Plano de ação").length;

  gerarGrafico();
}

function gerarGrafico() {
  const ctx = document.getElementById("grafico");
  if (!ctx) return;

  const labels = dados.map(d => d.dataFmt);
  const valores = dados.map(d => d.dias);

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Dias sem remessa",
        data: valores,
        backgroundColor: "#ff8c00"
      }]
    }
  });
}

function excluirArquivo() {
  localStorage.removeItem("sql42");
  location.reload();
}

// 🔁 Persistência
const salvo = localStorage.getItem("sql42");
if (salvo) {
  dados = JSON.parse(salvo);
  render();
}
