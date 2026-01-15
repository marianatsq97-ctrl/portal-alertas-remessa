fetch('./data/alerts.json')
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById('cards');

    data.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';

      let status = 'ok';
      if (item.dias >= 5 && item.dias <= 7) status = 'warn';
      if (item.dias > 7) status = 'danger';

      card.classList.add(status);

      card.innerHTML = `
        <h3>${item.cliente}</h3>
        <p>${item.dias} dias sem remessa</p>
      `;

      container.appendChild(card);
    });
  })
  .catch(err => console.error('Erro ao carregar alerts.json', err));
