const els = {
  meta: document.getElementById("meta"),
  badge: document.getElementById("badge"),
  bell: document.getElementById("bell"),
  status: document.getElementById("statusFilter"),
  search: document.getElementById("search"),
  refresh: document.getElementById("refresh"),
  summary: document.getElementById("summary"),
  tbody: document.getElementById("tbody"),
};

let cached = null;

function pill(label, value) {
  return `<span class="pill">${label}: <b>${value}</b></span>`;
}

function render() {
  if (!cached) return;

  els.meta.textContent = `Gerado em: ${cached.gerado_em} | Clientes: ${cached.total_clientes} | Plano de ação: ${cached.total_plano_de_acao}`;

  els.badge.textContent = String(cached.total_plano_de_acao || 0);
  els.badge.style.display = (cached.total_plano_de_acao || 0) > 0 ? "inline-block" : "none";

  els.summary.innerHTML =
    pill("🟢 OK", cached.contagem_status.OK) +
    pill("🟡 Atenção", cached.contagem_status.ATENCAO) +
    pill("🔴 Plano de ação", cached.contagem_status.PLANO_DE_ACAO);

  const status = els.status.value;
  const q = (els.search.value || "").trim().toLowerCase();

  const filtered = cached.registros.filter(r => {
    const okStatus = status === "TODOS" || r.Status === status;
    const hay = `${r.CodCliente} ${r.NomeCliente}`.toLowerCase();
    const okSearch = !q || hay.includes(q);
    return okStatus && okSearch;
  });

  els.tbody.innerHTML = filtered.map(r => `
    <tr>
      <td>${r.CodCliente || ""}</td>
      <td>${r.NomeCliente || ""}</td>
      <td>${r.DataUltimaRemessa || ""}</td>
      <td><b>${r.DiasSemRemessa}</b></td>
      <td class="status ${r.Status}">${r.Status}</td>
      <td>${r.Acao || ""}</td>
    </tr>
  `).join("");
}

async function load() {
  const res = await fetch("./alerts.json", { cache: "no-store" });
  cached = await res.json();
  render();
}

els.status.addEventListener("change", render);
els.search.addEventListener("input", render);
els.refresh.addEventListener("click", load);
els.bell.addEventListener("click", () => {
  els.status.value = "PLANO_DE_ACAO";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

load().catch(() => {
  els.meta.textContent = "Ainda sem alerts.json. Suba a planilha e rode o workflow.";
});
