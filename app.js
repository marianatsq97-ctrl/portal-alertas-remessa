const fileInput = document.getElementById("fileInput");
const tableBody = document.getElementById("tableBody");
const statusFilter = document.getElementById("statusFilter");

let dados = [];

fileInput.addEventListener("change", e => {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = evt => {
    const workbook = XLSX.read(evt.target.result, { type: "binary" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    dados = rows.map(linha => processarLinha(linha));
    renderTabela();
  };

  reader.readAsBinaryString(file);
});

statusFilter.addEventListener("change", renderTabela);

function processarLinha(linha) {
  // 🔴 AJUSTE ESTES NOMES PARA O SEU SQL42
  const cliente = linha["Cliente"];
  const material = linha["Material"];
  const quantidade = Number(linha["Quantidade"]) || 0;
  const dataRemessa = new Date(linha["Data Remessa"]);

  const hoje = new Date();
  const dias = Math.floor((hoje - dataRemessa) / (1000 * 60 * 60 * 24));

  let status = "OK";
  if (dias >= 5 && dias <= 7) status = "ATENCAO";
  if (dias > 7) status = "CRITICO";

  return {
    cliente,
    material,
    quantidade,
    dataRemessa,
    dias,
    status
  };
}

function renderTabela() {
  tableBody.innerHTML = "";

  dados
    .filter(d => statusFilter.value === "TODOS" || d.status === statusFilter.value)
    .forEach(d => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${d.cliente}</td>
        <td>${d.material}</td>
        <td>${d.dataRemessa.toLocaleDateString()}</td>
        <td>${d.quantidade}</td>
        <td>${d.dias}</td>
        <td class="${d.status}">${d.status}</td>
      `;

      tableBody.appendChild(tr);
    });
}
