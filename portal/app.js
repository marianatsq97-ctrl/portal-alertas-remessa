const dadosFake = [
  { cliente: "Cliente A", dias: 2 },
  { cliente: "Cliente B", dias: 6 },
  { cliente: "Cliente C", dias: 12 }
];

const container = document.getElementById("cards");

dadosFake.forEach(item => {
  const card = document.createElement("div");

  let status = "status-ok";
  if (item.dias >= 5 && item.dias <= 7) status = "status-warning";
  if (item.dias > 7) status = "status-danger";

  card.className = `card ${status}`;
  card.innerHTML = `
    <h3>${item.cliente}</h3>
    <p>Dias sem remessa: <strong>${item.dias}</strong></p>
  `;

  container.appendChild(card);
});
