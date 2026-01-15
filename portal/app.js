fetch("./alerts.json")
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById("cards");

    data.forEach(item => {
      const card = document.createElement("div");
      card.className = "card";

      let statusClass = "ok";
      let statusText = "OK";

      if (item.dias >= 5 && item.dias <= 7) {
        statusClass = "atencao";
        statusText = "Atenção";
      }

      if (item.dias > 7) {
        statusClass = "critico";
        statusText = "Plano de Ação";
      }

      card.innerHTML = `
        <h3>${item.cliente}</h3>
        <p>Dias sem remessa: <strong>${item.dias}</strong></p>
        <p class="status ${statusClass}">${statusText}</p>
      `;

      container.appendChild(card);
    });
  });
