const role = localStorage.getItem("role");

const fileInput = document.getElementById("fileInput");
const loadFileBtn = document.getElementById("loadFileBtn");
const clearBtn = document.getElementById("clearBtn");
const statusMsg = document.getElementById("statusMsg");

const tableBody = document.getElementById("tableBody");
const kpiContracts = document.getElementById("kpiContracts");
const kpiClients = document.getElementById("kpiClients");
const kpiVolume = document.getElementById("kpiVolume");

let allRows = [];

function setStatus(t){
  statusMsg.textContent = t || "";
}

function parseDate(v){
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function daysSince(d){
  if(!d) return null;
  return Math.floor((Date.now()-d.getTime())/86400000);
}

function render(){
  tableBody.innerHTML = allRows.map(r=>{
    const d = daysSince(r.date);
    return `
      <tr>
        <td>${r.cnpj}</td>
        <td>${r.contrato}</td>
        <td>${r.obra}</td>
        <td>${r.volume}</td>
        <td>${r.date ? r.date.toLocaleDateString("pt-BR") : ""}</td>
        <td>${d ?? ""}</td>
        <td>${d>21 ? "Plano de ação" : "OK"}</td>
      </tr>
    `;
  }).join("");

  kpiContracts.textContent = new Set(allRows.map(r=>r.contrato)).size;
  kpiClients.textContent = new Set(allRows.map(r=>r.cnpj)).size;
  kpiVolume.textContent = allRows.reduce((a,b)=>a+b.volume,0);
}

loadFileBtn.addEventListener("click", async ()=>{
  if(role!=="admin") return;

  const file = fileInput.files[0];
  if(!file){ setStatus("Selecione um arquivo."); return; }

  const data = await file.arrayBuffer();
  const wb = XLSX.read(data);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  allRows = rows.map(r=>({
    cnpj: r["CNPJ"] || r["Cliente"] || "",
    contrato: r["Contrato"] || "",
    obra: r["Nome da obra"] || "",
    volume: Number(r["Quantidade"] || 0),
    date: parseDate(r["Data da remessa"])
  }));

  render();
  setStatus("Arquivo carregado.");
});

clearBtn.addEventListener("click", ()=>{
  allRows = [];
  render();
  setStatus("Dados removidos.");
});
