async function carregar() {
  const res = await fetch("alerts.json");
  const data = await res.json();

  const tbody = document.getElementById("lista");
  const filtro = document.getElementById("statusFilter");
  const count = document.getElementById("count");

  function render() {
    tbody.innerHTML = "";
    let totalPlano = 0;

    data.registros.forEach(r => {
      if (filtro.value !== "TODOS" && r.Status !== filtro.value) return;

      if (r.Status === "PLANO_DE_ACAO") totalPlano++;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.CodCliente}</td>
        <td>${r.NomeCliente}</td>
        <td>${r.DataUltimaRemessa}</td>
        <td>${r.DiasSemRemessa}</td>
        <td class="${r.Status}">${r.Status}</td>
      `;
      tbody.appendChild(tr);
    });

    count.textContent = totalPlano;
  }

  filtro.addEventListener("change", render);
  render();
}

carregar();
