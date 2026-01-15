fetch("./data/alerts.json")
  .then(r => r.json())
  .then(lista => {
    const cards = document.getElementById("cards");

    lista.forEach(item => {
      let status = "status-ok";
      if (item.dias >= 5 && item.dias <= 7) status = "status-warning";
      if (item.dias > 7) status = "status-danger";

      const div = document.createElement("div");
      div.className = `card ${status}`;
      div.innerHTML = `
        <h3>${item.cliente}</h3>
        <p>Dias sem remessa: <strong>${item.dias}</strong></p>
      `;
      cards.appendChild(div);
    });
  });
