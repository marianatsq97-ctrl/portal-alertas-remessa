let dadosGlobais = [];

document.getElementById("fileInput").addEventListener("change", e => {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = evt => {
    const workbook = XLSX.read(evt.target.result, { type: "binary" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);

    processarDados(json);
  };

  reader.readAsBinaryString(file);
});

function processarDados(linhas) {
  const hoje = new Date();
  dadosGlobais = [];

  linhas.forEach(l => {
    if (!l.Cliente || !l["Última Remessa"]) return;

    const ultima = new Date(l["Última Remessa"]);
    const dias = Math.floor((hoje - ultima) / (1000 * 60 * 60 * 24));

    let status = "OK";
    if (dias >= 5 && dias <= 7) status = "Atenção";
    if (dias > 7) status = "Plano de ação";

    dadosGlobais.push({
      cliente: l.Cliente,
      material: l.Material || "-",
      data: ultima.toLocaleDateString(),
      quantidade: l.Quantidade || 0,
      dias,
      status
    });
  });

  renderTabela();
  renderDashboard();
}

function renderTabela() {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  dadosGlobais.forEach(d => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.cliente}</td>
      <td>${d.material}</td>
      <td>${d.data}</td>
      <td>${d.quantidade}</td>
      <td>${d.dias}</td>
      <td>${d.status}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderDashboard() {
  const ok = dadosGlobais.filter(d => d.status === "OK").length;
  const atencao = dadosGlobais.filter(d => d.status === "Atenção").length;
  const critico = dadosGlobais.filter(d => d.status === "Plano de ação").length;

  document.getElementById("okCount").textContent = ok;
  document.getElementById("atencaoCount").textContent = atencao;
  document.getElementById("criticoCount").textContent = critico;

  new Chart(document.getElementById("graficoStatus"), {
    type: "bar",
    data: {
      labels: ["OK", "Atenção", "Plano de ação"],
      datasets: [{
        data: [ok, atencao, critico],
        backgroundColor: ["#1e7f43", "#b58900", "#a83232"]
      }]
    }
  });
}

// Abas
document.querySelectorAll(".tab").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  };
});
