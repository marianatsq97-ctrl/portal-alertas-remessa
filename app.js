const fileInput = document.getElementById("fileInput");
const tableBody = document.getElementById("tableBody");
const statusFilter = document.getElementById("statusFilter");
const dateFilter = document.getElementById("dateFilter");

let dados = [];

fileInput.addEventListener("change", e => {
  const reader = new FileReader();
  reader.onload = evt => {
    const workbook = XLSX.read(evt.target.result, { type: "binary" });
    const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    dados = sheet.map(row => {
      const ultima = new Date(row["Data"]);
      const hoje = new Date();
      const dias = Math.floor((hoje - ultima) / (1000*60*60*24));

      let status = "OK";
      if (dias >= 5) status = "ATENCAO";
      if (dias >= 7) status = "PLANO";

      return {
        cliente: row["Cliente"],
        material: row["Material"],
        data: ultima,
        quantidade: row["Quantidade"],
        dias,
        status
      };
    });

    renderTabela();
    enviarEmail(dados.filter(d => d.status === "PLANO"));
  };

  reader.readAsBinaryString(e.target.files[0]);
});

function renderTabela() {
  tableBody.innerHTML = "";

  dados
    .filter(d => !statusFilter.value || d.status === statusFilter.value)
    .filter(d => !dateFilter.value || d.data.toISOString().slice(0,10) === dateFilter.value)
    .forEach(d => {
      tableBody.innerHTML += `
        <tr>
          <td>${d.cliente}</td>
          <td>${d.material}</td>
          <td>${d.data.toLocaleDateString()}</td>
          <td>${d.quantidade}</td>
          <td>${d.dias}</td>
          <td class="status-${d.status}">${d.status}</td>
        </tr>
      `;
    });
}

statusFilter.onchange = renderTabela;
dateFilter.onchange = renderTabela;

function enviarEmail(lista) {
  if (lista.length === 0) return;

  console.log("Enviar e-mail para:", lista);
  // Aqui entra EmailJS / webhook
}
