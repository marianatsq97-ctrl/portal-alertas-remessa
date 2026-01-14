async function carregar() {
  const res = await fetch("alerts.json");
  const data = await res.json();

  const tbody = document.getElementById("lista");
  const filtro = document.getElementById("statusFilter");

  function render() {
    tbody.innerHTML = "";
    data.registros.forEach(r => {
      if (filtro.value !== "TODOS" && r.Status !== filtro.value) return;

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
  }

  filtro.addEventListener("change", render);
  render();
}

carregar();
