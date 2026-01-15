fetch("./data/alerts.json")
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById("cards");

    data.forEach(item => {
      const card = document.createElement("div");

      let status = "ok";
      if (item.dias >= 5 && item.dias <= 7) status = "warn";
      if (item.dias > 7) status = "danger";

      card.className = `card ${status}`;
      card.innerHTML = `
        <h3>${item.cliente}</h3>
        <p>Dias sem remessa: <strong>${item.dias}</strong></p>
      `;

      container.appendChild(card);
    });
  });
