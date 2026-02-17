const STORAGE_KEY = "focoja.tasks.v2";
const INTEGRATIONS_KEY = "focoja.integrations.v1";

const taskForm = document.getElementById("taskForm");
const taskTitle = document.getElementById("taskTitle");
const taskArea = document.getElementById("taskArea");
const taskEnergy = document.getElementById("taskEnergy");
const taskPriority = document.getElementById("taskPriority");
const taskMinutes = document.getElementById("taskMinutes");
const taskNextStep = document.getElementById("taskNextStep");

const filterArea = document.getElementById("filterArea");
const filterPriority = document.getElementById("filterPriority");
const todayList = document.getElementById("todayList");
const taskList = document.getElementById("taskList");

const clickupToken = document.getElementById("clickupToken");
const clickupListId = document.getElementById("clickupListId");
const googleCalendarEmail = document.getElementById("googleCalendarEmail");
const defaultStartTime = document.getElementById("defaultStartTime");
const customIntegrationUrl = document.getElementById("customIntegrationUrl");
const btnSaveIntegrations = document.getElementById("btnSaveIntegrations");
const btnOpenGoogle = document.getElementById("btnOpenGoogle");
const btnOpenClickUp = document.getElementById("btnOpenClickUp");
const btnOpenCustom = document.getElementById("btnOpenCustom");

const executionDialog = document.getElementById("executionDialog");
const executionHint = document.getElementById("executionHint");
const executionContent = document.getElementById("executionContent");
const btnStartExecution = document.getElementById("btnStartExecution");
const btnDoneExecution = document.getElementById("btnDoneExecution");
const btnSkipExecution = document.getElementById("btnSkipExecution");
const btnCloseExecution = document.getElementById("btnCloseExecution");
const btnClearDay = document.getElementById("btnClearDay");

let tasks = readJSON(STORAGE_KEY, []);
let integrations = readJSON(INTEGRATIONS_KEY, {
  clickupToken: "",
  clickupListId: "",
  googleCalendarEmail: "",
  defaultStartTime: "09:00",
  customIntegrationUrl: "",
});
let executionPointer = 0;

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function saveIntegrations() {
  integrations = {
    clickupToken: clickupToken.value.trim(),
    clickupListId: clickupListId.value.trim(),
    googleCalendarEmail: googleCalendarEmail.value.trim(),
    defaultStartTime: defaultStartTime.value,
    customIntegrationUrl: customIntegrationUrl.value.trim(),
  };
  localStorage.setItem(INTEGRATIONS_KEY, JSON.stringify(integrations));
  alert("Integrações salvas no navegador.");
}

function loadIntegrationsForm() {
  clickupToken.value = integrations.clickupToken || "";
  clickupListId.value = integrations.clickupListId || "";
  googleCalendarEmail.value = integrations.googleCalendarEmail || "";
  defaultStartTime.value = integrations.defaultStartTime || "09:00";
  customIntegrationUrl.value = integrations.customIntegrationUrl || "";
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createTask(payload) {
  tasks.unshift({
    id: makeId(),
    title: payload.title,
    area: payload.area,
    energy: payload.energy,
    priority: payload.priority,
    minutes: Number(payload.minutes),
    nextStep: payload.nextStep,
    selectedToday: payload.priority === "Agora",
    done: false,
    createdAt: new Date().toISOString(),
  });
  normalizeTodaySelection();
  saveTasks();
  render();
}

function normalizeTodaySelection() {
  const selected = tasks.filter((task) => task.selectedToday && !task.done);
  if (selected.length <= 3) return;

  selected
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(3)
    .forEach((task) => {
      task.selectedToday = false;
    });
}

function toggleToday(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task || task.done) return;

  if (!task.selectedToday) {
    const count = tasks.filter((item) => item.selectedToday && !item.done).length;
    if (count >= 3) {
      alert("Você já definiu 3 focos para hoje.");
      return;
    }
  }

  task.selectedToday = !task.selectedToday;
  saveTasks();
  render();
}

function markDone(id, done = true) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;
  task.done = done;
  if (done) task.selectedToday = false;
  saveTasks();
  render();
}

function removeTask(id) {
  tasks = tasks.filter((item) => item.id !== id);
  saveTasks();
  render();
}

function buildGoogleLink(task) {
  const now = new Date();
  const [hour, minute] = (integrations.defaultStartTime || "09:00").split(":").map(Number);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
  const end = new Date(start.getTime() + task.minutes * 60000);

  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const text = encodeURIComponent(task.title);
  const details = encodeURIComponent(`Próxima ação: ${task.nextStep}\nÁrea: ${task.area}`);
  const dates = `${fmt(start)}/${fmt(end)}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&dates=${dates}`;
}

async function syncClickUp(task) {
  if (!integrations.clickupToken || !integrations.clickupListId) {
    alert("Informe Token e List ID do ClickUp em Integrações.");
    return;
  }

  try {
    const response = await fetch(`https://api.clickup.com/api/v2/list/${integrations.clickupListId}/task`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: integrations.clickupToken,
      },
      body: JSON.stringify({
        name: task.title,
        description: `Próxima ação: ${task.nextStep}\nÁrea: ${task.area}\nPrioridade: ${task.priority}`,
        due_date: Date.now() + task.minutes * 60000,
      }),
    });

    if (!response.ok) {
      throw new Error("Falha na API do ClickUp.");
    }

    const result = await response.json();
    if (result.url) {
      window.open(result.url, "_blank");
    }
    alert("Atividade enviada para o ClickUp.");
  } catch {
    alert("Não foi possível sincronizar com ClickUp. Verifique token/lista e permissões.");
  }
}

function syncNotes(task) {
  const text = `# ${task.title}\n\nPróxima ação: ${task.nextStep}\nÁrea: ${task.area}\nPrioridade: ${task.priority}\nTempo: ${task.minutes} minutos`;

  if (navigator.share) {
    navigator
      .share({
        title: "Anotação Foco Já",
        text,
      })
      .catch(() => {});
    return;
  }

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `nota-${task.title.toLowerCase().replace(/\s+/g, "-")}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function taskTemplate(task, compact = false) {
  const pr = task.priority.toLowerCase();
  return `
    <li class="item ${task.done ? "done" : ""}">
      <strong>${task.title}</strong>
      <p class="meta">Próxima ação: ${task.nextStep}</p>
      <div class="badges">
        <span class="badge">${task.area}</span>
        <span class="badge ${pr}">${task.priority}</span>
        <span class="badge">Energia ${task.energy}</span>
        <span class="badge">${task.minutes} min</span>
      </div>
      <div class="actions">
        ${
          compact
            ? ""
            : `<button class="btn btn-ghost" data-action="today" data-id="${task.id}">${
                task.selectedToday ? "Remover do dia" : "Planejar hoje"
              }</button>
               <button class="btn btn-ghost" data-action="done" data-id="${task.id}">${
                 task.done ? "Reabrir" : "Concluir"
               }</button>
               <button class="btn btn-ghost" data-action="remove" data-id="${task.id}">Excluir</button>`
        }
        <button class="btn btn-ghost" data-action="google" data-id="${task.id}">Google Agenda</button>
        <button class="btn btn-ghost" data-action="clickup" data-id="${task.id}">ClickUp</button>
        <button class="btn btn-ghost" data-action="notes" data-id="${task.id}">Notas celular</button>
      </div>
    </li>
  `;
}

function renderToday() {
  const items = tasks.filter((task) => task.selectedToday && !task.done);
  todayList.innerHTML = items.length
    ? items.map((task) => taskTemplate(task, true)).join("")
    : '<li class="item">Sem foco definido. Escolha até 3 tarefas abaixo.</li>';
}

function renderTasks() {
  const area = filterArea.value;
  const priority = filterPriority.value;

  const filtered = tasks.filter((task) => {
    const okArea = area === "Todas" || task.area === area;
    const okPriority = priority === "Todas" || task.priority === priority;
    return okArea && okPriority;
  });

  taskList.innerHTML = filtered.length
    ? filtered.map((task) => taskTemplate(task)).join("")
    : '<li class="item">Nenhuma atividade para esse filtro.</li>';
}

function executionQueue() {
  const order = { Agora: 0, Hoje: 1, Depois: 2 };
  return tasks
    .filter((task) => task.selectedToday && !task.done)
    .sort((a, b) => order[a.priority] - order[b.priority]);
}

function renderExecutionMode() {
  const queue = executionQueue();
  if (!queue.length) {
    executionHint.textContent = "Sem atividade no plano de hoje.";
    executionContent.innerHTML = "";
    btnDoneExecution.dataset.id = "";
    return;
  }

  if (executionPointer >= queue.length) executionPointer = 0;
  const task = queue[executionPointer];

  executionHint.textContent = `Foco ${executionPointer + 1}/${queue.length}`;
  executionContent.innerHTML = `
    <div class="execution-focus">
      <h3>${task.title}</h3>
      <p><strong>Próxima ação:</strong> ${task.nextStep}</p>
      <p class="meta">Faça apenas essa tarefa por ${task.minutes} minutos.</p>
    </div>
  `;
  btnDoneExecution.dataset.id = task.id;
}

function render() {
  renderToday();
  renderTasks();
  renderExecutionMode();
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createTask({
    title: taskTitle.value.trim(),
    area: taskArea.value,
    energy: taskEnergy.value,
    priority: taskPriority.value,
    minutes: taskMinutes.value,
    nextStep: taskNextStep.value.trim(),
  });
  taskForm.reset();
  taskMinutes.value = 25;
  taskTitle.focus();
});

[filterArea, filterPriority].forEach((el) => el.addEventListener("change", renderTasks));

function getTaskByButton(event) {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return null;
  const id = target.dataset.id;
  const action = target.dataset.action;
  const task = tasks.find((item) => item.id === id);
  return { target, id, action, task };
}

[todayList, taskList].forEach((listEl) => {
  listEl.addEventListener("click", async (event) => {
    const ctx = getTaskByButton(event);
    if (!ctx || !ctx.task) return;

    if (ctx.action === "today") toggleToday(ctx.id);
    if (ctx.action === "done") markDone(ctx.id, !ctx.task.done);
    if (ctx.action === "remove") removeTask(ctx.id);
    if (ctx.action === "google") window.open(buildGoogleLink(ctx.task), "_blank");
    if (ctx.action === "clickup") await syncClickUp(ctx.task);
    if (ctx.action === "notes") syncNotes(ctx.task);
  });
});

btnSaveIntegrations.addEventListener("click", saveIntegrations);
btnOpenGoogle.addEventListener("click", () => window.open("https://calendar.google.com", "_blank"));
btnOpenClickUp.addEventListener("click", () => window.open("https://app.clickup.com", "_blank"));
btnOpenCustom.addEventListener("click", () => {
  if (!customIntegrationUrl.value.trim()) {
    alert("Informe um link externo primeiro.");
    return;
  }
  window.open(customIntegrationUrl.value.trim(), "_blank");
});

btnStartExecution.addEventListener("click", () => {
  executionPointer = 0;
  renderExecutionMode();
  executionDialog.showModal();
});

btnDoneExecution.addEventListener("click", () => {
  const id = btnDoneExecution.dataset.id;
  if (!id) return;
  markDone(id, true);
  renderExecutionMode();
});

btnSkipExecution.addEventListener("click", () => {
  const queue = executionQueue();
  if (!queue.length) return;
  executionPointer = (executionPointer + 1) % queue.length;
  renderExecutionMode();
});

btnCloseExecution.addEventListener("click", () => executionDialog.close());

btnClearDay.addEventListener("click", () => {
  tasks.forEach((task) => {
    task.selectedToday = false;
  });
  saveTasks();
  render();
});

loadIntegrationsForm();
render();
