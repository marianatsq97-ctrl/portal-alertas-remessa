async function carregarAlertas() {
  try {
    const res = await fetch("./alerts.json", { cache: "no-store" });
    const data = await res.json();

    document.getElementById("meta").innerText =
      `Gerado em: ${data.gerado_em} | Total: ${data.total_alertas}`;

    document.getElementById("total").innerText = data.total_alertas;

    const tbody = document.getElementById("alertsBody");
    tbody.innerHTML = "";

    data.alertas.forEach(a => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${a.CodCliente} - ${a.NomeCliente}</td>
        <td>${a.DataUltimaRemessa}</td>
        <td>${a.DiasSemRemessa}</td>
        <td style="color:#ff3f96;">Plano de ação</td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error(err);
  }
}

carregarAlertas();
