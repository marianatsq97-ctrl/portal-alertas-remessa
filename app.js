let data = [];
let chart;

function openPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

document.getElementById('fileInput').addEventListener('change', e => {
  const reader = new FileReader();
  reader.onload = evt => {
    const wb = XLSX.read(evt.target.result, { type: 'binary' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    data = XLSX.utils.sheet_to_json(sheet);

    renderTable(data);
    updateDashboard(data);
  };
  reader.readAsBinaryString(e.target.files[0]);
});

function renderTable(rows) {
  const body = document.getElementById('tableBody');
  body.innerHTML = '';

  rows.forEach(r => {
    const last = new Date(r["Última Remessa"]);
    const days = Math.floor((new Date() - last) / 86400000);

    let status = days <= 4 ? "OK" : days <= 7 ? "Atenção" : "Plano de ação";

    body.innerHTML += `
      <tr>
        <td>${r.Cliente}</td>
        <td>${r.Material || "-"}</td>
        <td>${r["Última Remessa"]}</td>
        <td>${r.Quantidade || "-"}</td>
        <td>${days}</td>
        <td>${status}</td>
      </tr>`;
  });
}

function updateDashboard(rows) {
  let ok = 0, warn = 0, danger = 0;

  rows.forEach(r => {
    const days = Math.floor((new Date() - new Date(r["Última Remessa"])) / 86400000);
    if (days <= 4) ok++;
    else if (days <= 7) warn++;
    else danger++;
  });

  document.getElementById('count-ok').textContent = ok;
  document.getElementById('count-warn').textContent = warn;
  document.getElementById('count-danger').textContent = danger;

  const ctx = document.getElementById('chart');
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['OK', 'Atenção', 'Plano de ação'],
      datasets: [{
        data: [ok, warn, danger],
        backgroundColor: ['#00ff99', '#ffcc00', '#ff4444']
      }]
    }
  });
}

function filterColumn(index) {
  const value = prompt("Digite o valor para filtrar:");
  if (!value) return;

  const filtered = data.filter(r =>
    Object.values(r)[index]?.toString().toLowerCase().includes(value.toLowerCase())
  );

  renderTable(filtered);
}
