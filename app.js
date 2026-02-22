const tableBody = document.getElementById('tableBody');
const recordsInfo = document.getElementById('recordsInfo');
const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const statusMsg = document.getElementById('statusMsg');
const chartBars = document.getElementById('chartBars');
const chartLabels = document.getElementById('chartLabels');

const monthFilter = document.getElementById('monthFilter');
const yearFilter = document.getElementById('yearFilter');

let rawData = [];

function parseDateBR(dateStr) {
  if (!dateStr) return null;
  const [d, m, y] = dateStr.split('/').map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function daysWithoutShipment(dateStr) {
  const date = parseDateBR(dateStr);
  if (!date) return 0;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function statusFromDays(days) {
  if (days <= 7) return { text: 'OK', css: 'ok' };
  if (days <= 14) return { text: 'Atenção', css: 'warn' };
  if (days <= 21) return { text: 'Atenção grave', css: 'grave' };
  return { text: 'Plano de ação', css: 'action' };
}

function populateFilters(data) {
  const years = [...new Set(data.map(item => (parseDateBR(item['Data da remessa']) || new Date()).getFullYear()))].sort();
  const months = [...new Set(data.map(item => (parseDateBR(item['Data da remessa']) || new Date()).getMonth() + 1))].sort((a, b) => a - b);

  yearFilter.innerHTML = '<option value="todos">Ano: todos</option>' + years.map(y => `<option value="${y}">Ano: ${y}</option>`).join('');
  monthFilter.innerHTML = '<option value="todos">Mês: todos</option>' + months.map(m => `<option value="${m}">Mês: ${String(m).padStart(2, '0')}</option>`).join('');
}

function filteredData() {
  return rawData.filter(item => {
    const dt = parseDateBR(item['Data da remessa']);
    if (!dt) return false;
    const yearOk = yearFilter.value === 'todos' || String(dt.getFullYear()) === yearFilter.value;
    const monthOk = monthFilter.value === 'todos' || String(dt.getMonth() + 1) === monthFilter.value;
    return yearOk && monthOk;
  });
}

function updateSummary(data) {
  const count = { ok: 0, warn: 0, grave: 0, action: 0 };
  data.forEach(item => {
    const st = statusFromDays(daysWithoutShipment(item['Data da remessa']));
    count[st.css] += 1;
  });

  document.getElementById('ok').textContent = count.ok;
  document.getElementById('warn').textContent = count.warn;
  document.getElementById('grave').textContent = count.grave;
  document.getElementById('action').textContent = count.action;

  document.getElementById('contratos').textContent = new Set(data.map(item => item.Contrato)).size;
  document.getElementById('clientes').textContent = new Set(data.map(item => item.Cliente)).size;
  document.getElementById('volume').textContent = data.reduce((acc, item) => acc + Number(item.Quantidade || 0), 0);
}

function renderChart(data) {
  const grouped = {};
  data.forEach(item => {
    const dt = parseDateBR(item['Data da remessa']);
    if (!dt) return;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    grouped[key] = (grouped[key] || 0) + Number(item.Quantidade || 0);
  });

  const entries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(...entries.map(([, value]) => value), 1);

  chartBars.innerHTML = '';
  chartLabels.innerHTML = '';

  entries.forEach(([label, value]) => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${Math.max(18, (value / max) * 200)}px`;
    bar.title = `${label}: ${value}`;
    chartBars.appendChild(bar);

    const text = document.createElement('span');
    text.textContent = label;
    text.style.width = '48px';
    text.style.textAlign = 'center';
    chartLabels.appendChild(text);
  });
}

function renderTable(data) {
  const sorted = [...data].sort((a, b) => daysWithoutShipment(b['Data da remessa']) - daysWithoutShipment(a['Data da remessa']));

  tableBody.innerHTML = sorted.map(item => {
    const days = daysWithoutShipment(item['Data da remessa']);
    const status = statusFromDays(days);
    const months = (days / 30).toFixed(1);

    return `
      <tr>
        <td>-<br><small>${item.Cliente || ''}</small></td>
        <td>${item.Contrato || '-'}</td>
        <td>-</td>
        <td>${item.Quantidade || 0}</td>
        <td>${item['Data da remessa'] || '-'}</td>
        <td>${days} dias (${months} meses)</td>
        <td><span class="badge ${status.css}">${status.text}</span></td>
      </tr>`;
  }).join('');

  recordsInfo.textContent = `Mostrando ${sorted.length} de ${sorted.length} registros • Página 1/1`;
}

function renderAll() {
  const data = filteredData();
  updateSummary(data);
  renderChart(data);
  renderTable(data);
}

async function loadDemo() {
  const response = await fetch('data/demo.json');
  rawData = await response.json();
  populateFilters(rawData);
  renderAll();
  statusMsg.textContent = 'Demo carregada com sucesso.';
}

function clearData() {
  rawData = [];
  tableBody.innerHTML = '';
  chartBars.innerHTML = '';
  chartLabels.innerHTML = '';
  recordsInfo.textContent = 'Mostrando 0 de 0 registros';
  ['ok', 'warn', 'grave', 'action', 'contratos', 'clientes', 'volume'].forEach(id => {
    document.getElementById(id).textContent = '0';
  });
  statusMsg.textContent = 'Dados removidos.';
}

function readSelectedFile() {
  const file = fileInput.files?.[0];
  if (!file) {
    statusMsg.textContent = 'Selecione um arquivo antes de carregar.';
    return;
  }

  fileName.textContent = file.name;
  const reader = new FileReader();
  reader.onload = event => {
    try {
      rawData = JSON.parse(String(event.target?.result || '[]'));
      populateFilters(rawData);
      renderAll();
      statusMsg.textContent = 'Arquivo carregado com sucesso.';
    } catch {
      statusMsg.textContent = 'Falha ao ler o arquivo (formato esperado: JSON).';
    }
  };
  reader.readAsText(file);
}

document.getElementById('loadFileBtn').addEventListener('click', readSelectedFile);
document.getElementById('loadDemoBtn').addEventListener('click', loadDemo);
document.getElementById('clearBtn').addEventListener('click', clearData);
document.getElementById('refreshChartBtn').addEventListener('click', renderAll);

fileInput.addEventListener('change', () => {
  fileName.textContent = fileInput.files?.[0]?.name || 'Nenhum arquivo selecionado';
});

yearFilter.addEventListener('change', renderAll);
monthFilter.addEventListener('change', renderAll);

loadDemo();
