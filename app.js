const USERS = {
  admin: { senha: "admin123", role: "admin" },
  usuario: { senha: "usuario123", role: "user" }
};

let dados = JSON.parse(localStorage.getItem("remessas")) || [];

/* LOGIN */
function login() {
  const u = loginUser.value;
  const p = loginPass.value;

  if (!USERS[u] || USERS[u].senha !== p) {
    loginError.innerText = "Usuário ou senha inválidos";
    return;
  }

  sessionStorage.setItem("perfil", USERS[u].role);
  iniciarSistema();
}

function logout() {
  sessionStorage.clear();
  location.reload();
}

function iniciarSistema() {
  loginScreen.classList.add("hidden");
  app.classList.remove("hidden");

  const perfil = sessionStorage.getItem("perfil");
  perfilInfo.innerText = `Perfil: ${perfil === "admin" ? "Administrador" : "Usuário"}`;

  if (perfil !== "admin") {
    importPanel.style.display = "none";
  }

  render();
}

/* IMPORTAÇÃO */
function importarArquivo() {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    const wb = XLSX.read(e.target.result, { type: "binary" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    dados = XLSX.utils.sheet_to_json(ws);
    localStorage.setItem("remessas", JSON.stringify(dados));
    render();
  };
  reader.readAsBinaryString(file);
}

function excluirArquivo() {
  if (!confirm("Excluir dados?")) return;
  localStorage.removeItem("remessas");
  dados = [];
  render();
}

/* STATUS */
function statusPorDias(dias) {
  if (dias <= 7) return { t: "OK", c: "#2ecc71" };
  if (dias <= 14) return { t: "Atenção", c: "#f1c40f" };
  if (dias <= 21) return { t: "Atenção Grave", c: "#e67e22" };
  return { t: "Plano de Ação", c: "#e74c3c" };
}

/* RENDER */
function render() {
  tbody.innerHTML = "";
  cards.innerHTML = "";

  const cont = { OK: 0, "Atenção": 0, "Atenção Grave": 0, "Plano de Ação": 0 };

  dados.forEach(r => {
    const d = new Date(r["DATA DA REMESSA"] || r["Data da remessa"]);
    const dias = Math.floor((Date.now() - d) / 86400000);
    const st = statusPorDias(dias);

    cont[st.t]++;

    tbody.innerHTML += `
      <tr>
        <td>${r.CLIENTE || ""}</td>
        <td>${r.CONTRATO || ""}</td>
        <td>${r.VENDEDOR || ""}</td>
        <td>${r.TRAÇO || ""}</td>
        <td>${d.toLocaleDateString()}</td>
        <td>${dias}</td>
        <td><span class="badge" style="background:${st.c}">${st.t}</span></td>
      </tr>`;
  });

  Object.entries(cont).forEach(([k, v]) => {
    cards.innerHTML += `
      <div class="card" style="border-color:${statusPorDias(
        k === "OK" ? 1 : k === "Atenção" ? 10 : k === "Atenção Grave" ? 18 : 30
      ).c}">
        <b>${k}</b><br>${v}
      </div>`;
  });
}

/* INIT */
if (sessionStorage.getItem("perfil")) iniciarSistema();
