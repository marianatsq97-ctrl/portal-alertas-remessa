const tableBody = document.getElementById('tableBody');
const recordsInfo = document.getElementById('recordsInfo');
const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const statusMsg = document.getElementById('statusMsg');
const chartBars = document.getElementById('chartBars');
const chartLabels = document.getElementById('chartLabels');

const monthFilter = document.getElementById('monthFilter');
const yearFilter = document.getElementById('yearFilter');
const startDate = document.getElementById('startDate');
const endDate = document.getElementById('endDate');

let rawData = [];

const keyAliases = {
  cliente: ['Cliente', 'CLIENTE', 'Razão Social', 'RAZAO SOCIAL', 'CNPJ / Cliente'],
  contrato: ['Contrato', 'CONTRATO', 'Nº Contrato', 'Numero Contrato'],
  data: ['Data da remessa', 'DATA DA REMESSA', 'Data Remessa', 'DT REMESSA', 'Última remessa'],
  quantidade: ['Quantidade', 'QUANTIDADE', 'Volume', 'Volume da obra', 'QTD'],
  obra: ['Nome da obra', 'OBRA', 'Obra', 'Empreendimento'],
  cnpj: ['CNPJ', 'Cnpj']
};

function pickValue(source, aliases) {
  for (const key of aliases) {
    if (source[key] !== undefined && source[key] !== null && String(source[key]).trim() !== '') {
      return source[key];
    }
  }
  return '';
}

function excelSerialToDate(serial) {
  const utcDays = Math.floor(Number(serial) - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

function parseDate(value) {
  if (!value && value !== 0) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === 'number') {
    const d = excelSerialToDate(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (raw.includes('/')) {
    const [a, b, c] = raw.split('/').map(Number);
    if (a > 12) return new Date(c, b - 1, a);
    return new Date(c, b - 1, a);
  }

  if (raw.includes('-')) {
    const [y, m, d] = raw.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatDateBR(date) {
  if (!date) return '-';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function normalizeRecord(row) {
  const dateObj = parseDate(pickValue(row, keyAliases.data));
  return {
    cliente: String(pickValue(row, keyAliases.cliente) || '').trim(),
    contrato: String(pickValue(row, keyAliases.contrato) || '').trim(),
    obra: String(pickValue(row, keyAliases.obra) || '').trim(),
    cnpj: String(pickValue(row, keyAliases.cnpj) || '').trim(),
    quantidade: Number(pickValue(row, keyAliases.quantidade) || 0),
    dataObj: dateObj,
    dataTexto: formatDateBR(dateObj)
  };
}

function daysWithoutShipment(dateObj) {
  if (!dateObj) return 0;
  return Math.floor((Date.now() - dateObj.getTime()) / 86400000);
}

function statusFromDays(days) {
  if (days <= 7) return { text: 'OK', css: 'ok' };
  if (days <= 14) return { text: 'Atenção', css: 'warn' };
  if (days <= 21) return { text: 'Atenção grave', css: 'grave' };
  return { text: 'Plano de ação', css: 'action' };
}

function populateFilters(data) {
  const validDates = data.map(item => item.dataObj).filter(Boolean);
  const years = [...new Set(validDates.map(dt => dt.getFullYear()))].sort((a, b) => a - b);
  const months = [...new Set(validDates.map(dt => dt.getMonth() + 1))].sort((a, b) => a - b);

  yearFilter.innerHTML = '<option value="todos">Ano: todos</option>' + years.map(y => `<option value="${y}">Ano: ${y}</option>`).join('');
  monthFilter.innerHTML = '<option value="todos">Mês: todos</option>' + months.map(m => `<option value="${m}">Mês: ${String(m).padStart(2, '0')}</option>`).join('');
}

function inDateRange(dateObj) {
  if (!dateObj) return false;
  const start = startDate.value ? new Date(`${startDate.value}T00:00:00`) : null;
  const end = endDate.value ? new Date(`${endDate.value}T23:59:59`) : null;

  if (start && dateObj < start) return false;
  if (end && dateObj > end) return false;
  return true;
}

function filteredData() {
  return rawData.filter(item => {
    if (!item.dataObj || !inDateRange(item.dataObj)) return false;
    const yearOk = yearFilter.value === 'todos' || String(item.dataObj.getFullYear()) === yearFilter.value;
    const monthOk = monthFilter.value === 'todos' || String(item.dataObj.getMonth() + 1) === monthFilter.value;
    return yearOk && monthOk;
  });
}

function updateSummary(data) {
  const count = { ok: 0, warn: 0, grave: 0, action: 0 };
  data.forEach(item => {
    const st = statusFromDays(daysWithoutShipment(item.dataObj));
    count[st.css] += 1;
  });

  document.getElementById('ok').textContent = count.ok;
  document.getElementById('warn').textContent = count.warn;
  document.getElementById('grave').textContent = count.grave;
  document.getElementById('action').textContent = count.action;

  document.getElementById('contratos').textContent = new Set(data.map(item => item.contrato).filter(Boolean)).size;
  document.getElementById('clientes').textContent = new Set(data.map(item => item.cliente).filter(Boolean)).size;
  document.getElementById('volume').textContent = data.reduce((acc, item) => acc + Number(item.quantidade || 0), 0);
}

function renderChart(data) {
  const grouped = {};
  data.forEach(item => {
    if (!item.dataObj) return;
    const key = `${item.dataObj.getFullYear()}-${String(item.dataObj.getMonth() + 1).padStart(2, '0')}`;
    grouped[key] = (grouped[key] || 0) + Number(item.quantidade || 0);
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
  const sorted = [...data].sort((a, b) => daysWithoutShipment(b.dataObj) - daysWithoutShipment(a.dataObj));

  tableBody.innerHTML = sorted.map(item => {
    const days = daysWithoutShipment(item.dataObj);
    const status = statusFromDays(days);
    const months = (days / 30).toFixed(1);

    return `
      <tr>
        <td>${item.cnpj || '-'}<br><small>${item.cliente || ''}</small></td>
        <td>${item.contrato || '-'}</td>
        <td>${item.obra || '-'}</td>
        <td>${item.quantidade || 0}</td>
        <td>${item.dataTexto}</td>
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
  const demo = await response.json();
  rawData = demo.map(normalizeRecord).filter(item => item.dataObj);
  populateFilters(rawData);
  renderAll();
  statusMsg.textContent = `Demo carregada com sucesso (${rawData.length} registros).`;
}

function clearData() {
  rawData = [];
  tableBody.innerHTML = '';
  chartBars.innerHTML = '';
  chartLabels.innerHTML = '';
  recordsInfo.textContent = 'Mostrando 0 de 0 registros';
  startDate.value = '';
  endDate.value = '';
  ['ok', 'warn', 'grave', 'action', 'contratos', 'clientes', 'volume'].forEach(id => {
    document.getElementById(id).textContent = '0';
  });
  statusMsg.textContent = 'Dados removidos.';
}

function parseByExtension(file, text, binary) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'json') {
    return JSON.parse(text);
  }

  if (ext === 'csv') {
    const wb = XLSX.read(text, { type: 'string' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: '' });
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const wb = XLSX.read(binary, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: '' });
  }

  throw new Error('Formato não suportado.');
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
      const text = typeof event.target?.result === 'string' ? event.target.result : '';
      const binary = event.target?.result;
      const rows = parseByExtension(file, text, binary);
      const normalized = rows.map(normalizeRecord).filter(item => item.dataObj);

      rawData = normalized;
      populateFilters(rawData);
      renderAll();

      statusMsg.textContent = `Arquivo carregado com sucesso (${rawData.length} registros válidos).`;
    } catch (error) {
      statusMsg.textContent = `Falha ao ler arquivo: ${error.message}`;
    }
  };

  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file);
  }
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
startDate.addEventListener('change', renderAll);
endDate.addEventListener('change', renderAll);

loadDemo();
