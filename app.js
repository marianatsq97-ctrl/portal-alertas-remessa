fetch("data/alerts.json")
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById("cards");

    data.forEach(item => {
      let status = "ok";
      let label = "OK";

      if (item.dias >= 5 && item.dias <= 7) {
        status = "attention";
        label = "Atenção";
      } else if (item.dias > 7) {
        status = "action";
        label = "Plano de ação";
      }

      const card = document.createElement("div");
      card.className = `card ${status}`;
      card.innerHTML = `
        <h3>${item.cliente}</h3>
        <p>${item.dias} dias sem remessa</p>
        <strong>${label}</strong>
      `;

      container.appendChild(card);
    });
  });
