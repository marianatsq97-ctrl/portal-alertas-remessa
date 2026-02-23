/* ================= LOGIN ================= */

const role = localStorage.getItem("role");
if(!role){
  window.location.href = "login.html";
}

function logout(){
  localStorage.removeItem("role");
  window.location.href = "login.html";
}

if(role === "user"){
  document.getElementById("adminPanel").style.display = "none";
}

/* ================= VARIÁVEIS ================= */

const fileInput = document.getElementById("fileInput");
const tableBody = document.getElementById("tableBody");
const statusMsg = document.getElementById("statusMsg");

let rawData = [];

/* ================= UTIL ================= */

function parseDate(v){
  if(!v) return null;
  if(v instanceof Date) return v;
  if(typeof v === "number"){
    return new Date((v - 25569) * 86400 * 1000);
  }
  const parts = String(v).split("/");
  if(parts.length === 3){
    return new Date(parts[2], parts[1]-1, parts[0]);
  }
  return new Date(v);
}

function formatDate(d){
  if(!d || isNaN(d)) return "";
  return d.toLocaleDateString("pt-BR");
}

function daysWithout(d){
  if(!d) return null;
  return Math.floor((new Date() - d)/86400000);
}

function formatDays(days){
  if(days === null) return "";
  if(days > 365) return (days/365).toFixed(1) + " anos";
  if(days > 31) return (days/30).toFixed(1) + " meses";
  return days + " dias";
}

function status(days){
  if(days <= 7) return ["OK","ok"];
  if(days <= 14) return ["Atenção","warn"];
  if(days <= 21) return ["Atenção grave","grave"];
  return ["Plano de ação","action"];
}

/* ================= IMPORTAÇÃO ================= */

document.getElementById("loadFileBtn").addEventListener("click", async ()=>{

  const file = fileInput.files[0];
  if(!file){
    statusMsg.textContent = "Selecione um arquivo";
    return;
  }

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet,{defval:""});

  rawData = rows.map(r=>{

    const volume = parseFloat(
      String(r["VOLUME"] || r["Volume"] || r["Quantidade"] || 0)
      .replace(/\./g,"")
      .replace(",",".")
    ) || 0;

    const dataObj = parseDate(
      r["DATA"] || r["Data"] || r["Última remessa"]
    );

    return {
      cnpj: r["CNPJ"] || r["CNPJ / Cliente"] || "",
      contrato: r["CONTRATO"] || r["Contrato"] || "",
      obra: r["OBRA"] || r["Nome da obra"] || "",
      volume,
      dataObj
    };

  });

  render();
  statusMsg.textContent = rawData.length + " linhas carregadas";
});

/* ================= RENDER ================= */

function render(){

  const sorted = [...rawData].sort((a,b)=>{
    const da = daysWithout(a.dataObj);
    const db = daysWithout(b.dataObj);
    return db - da;
  });

  tableBody.innerHTML = sorted.map(r=>{

    const d = daysWithout(r.dataObj);
    const st = status(d);

    return `
      <tr>
        <td>${r.cnpj}</td>
        <td>${r.contrato}</td>
        <td>${r.obra}</td>
        <td>${r.volume}</td>
        <td>${formatDate(r.dataObj)}</td>
        <td>${formatDays(d)}</td>
        <td><span class="${st[1]}">${st[0]}</span></td>
      </tr>
    `;

  }).join("");

  document.getElementById("contratos").textContent =
    new Set(sorted.map(i=>i.contrato)).size;

  document.getElementById("clientes").textContent =
    new Set(sorted.map(i=>i.cnpj)).size;

  document.getElementById("volume").textContent =
    sorted.reduce((a,b)=>a + b.volume,0);

  const counters = {ok:0,warn:0,grave:0,action:0};

  sorted.forEach(r=>{
    const s = status(daysWithout(r.dataObj))[1];
    counters[s]++;
  });

  document.getElementById("ok").textContent = counters.ok;
  document.getElementById("warn").textContent = counters.warn;
  document.getElementById("grave").textContent = counters.grave;
  document.getElementById("action").textContent = counters.action;
}

/* ================= LIMPAR ================= */

document.getElementById("clearBtn").addEventListener("click", ()=>{
  rawData = [];
  tableBody.innerHTML = "";
  render();
});
