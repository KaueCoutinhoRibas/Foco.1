const STORAGE_KEY = 'foco-productivity-v1';
const $ = (selector) => document.querySelector(selector);
// Datas precisam respeitar o fuso horário do aparelho. `toISOString()` usa UTC
// e, no Brasil, pode adiantar a data algumas horas antes da meia-noite local.
const dateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const todayKey = () => dateKey();
const id = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const defaults = () => ({ version: 1, habitDefs: [{ id: id(), title: 'Ler', target: 10 }, { id: id(), title: 'Estudar', target: 1 }, { id: id(), title: 'Exercício', target: 1 }, { id: id(), title: 'Beber água', target: 1 }], days: {} });
let state;
function load() { try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); return saved?.version === 1 && saved.days && saved.habitDefs ? saved : defaults(); } catch { return defaults(); } }
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function pendingTasksFromPreviousDay(date) {
  const previousDates = Object.keys(state.days).filter(key => key < date).sort().reverse();
  const previousDay = state.days[previousDates[0]];
  return previousDay ? previousDay.tasks.filter(task => !task.done).map(task => ({ id: id(), title: task.title, done: false })) : [];
}
function ensureDay(date = todayKey()) {
  if (!state.days[date]) state.days[date] = { tasks: pendingTasksFromPreviousDay(date), habits: Object.fromEntries(state.habitDefs.map(h => [h.id, 0])), notes: '' };
  const day = state.days[date];
  state.habitDefs.forEach(h => { if (!(h.id in day.habits)) day.habits[h.id] = 0; });
  return day;
}
function dateLabel(key, long = false) { const date = new Date(`${key}T12:00:00`); return new Intl.DateTimeFormat('pt-BR', long ? { weekday:'long', day:'numeric', month:'long' } : { day:'2-digit', month:'short' }).format(date).replace(/^./, c => c.toUpperCase()); }
function getStats(day) { const taskTotal = day.tasks.length; const taskDone = day.tasks.filter(t => t.done).length; const habits = state.habitDefs; const habitDone = habits.filter(h => (day.habits[h.id] || 0) >= h.target).length; const total = taskTotal + habits.length; const completed = taskDone + habitDone; return { taskTotal, taskDone, habitDone, total, completed, percent: total ? Math.round(completed / total * 100) : 0 }; }
function isProductive(day) { const s = getStats(day); return s.total > 0 && s.percent >= 60; }
function streak() { let count = 0, cursor = new Date(`${todayKey()}T12:00:00`); while (true) { const key = dateKey(cursor); if (!state.days[key] || !isProductive(state.days[key])) break; count++; cursor.setDate(cursor.getDate() - 1); } return count; }
function escapeText(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function renderTasks(day) { const list = $('#taskList'); list.innerHTML = day.tasks.length ? day.tasks.map(t => `<div class="item ${t.done ? 'done' : ''}"><input class="check" type="checkbox" data-task-check="${t.id}" ${t.done ? 'checked' : ''} aria-label="Concluir ${escapeText(t.title)}"><span class="item-title">${escapeText(t.title)}</span><div class="item-actions"><button class="tiny-button" data-task-edit="${t.id}" aria-label="Editar">✎</button><button class="tiny-button" data-task-delete="${t.id}" aria-label="Excluir">×</button></div></div>`).join('') : '<p class="muted">Nenhuma tarefa por aqui. Que tal adicionar uma?</p>'; }
function renderHabits(day) { const list = $('#habitList'); $('#habitsCount').textContent = `${state.habitDefs.filter(h => day.habits[h.id] >= h.target).length}/${state.habitDefs.length}`; list.innerHTML = state.habitDefs.length ? state.habitDefs.map(h => { const value = day.habits[h.id] || 0, done = value >= h.target; if (h.target === 1) return `<div class="item ${done ? 'done' : ''}"><input class="check" type="checkbox" data-habit-toggle="${h.id}" ${done?'checked':''} aria-label="Concluir ${escapeText(h.title)}"><span class="item-title">${escapeText(h.title)}</span></div>`; return `<div class="item ${done ? 'done' : ''}"><span class="item-title">${escapeText(h.title)}<span class="habit-meta">${value} / ${h.target}</span></span><div class="counter"><button data-habit-minus="${h.id}" aria-label="Diminuir">−</button><strong>${value}/${h.target}</strong><button data-habit-plus="${h.id}" aria-label="Aumentar">+</button></div></div>`; }).join('') : '<p class="muted">Crie um hábito em Ajustes.</p>'; }
function renderToday() { const day = ensureDay(); const hour = new Date().getHours(); $('#currentDate').textContent = dateLabel(todayKey(), true).toUpperCase(); $('#greeting').textContent = `${hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'}, Kauê.`; const s = getStats(day); $('#progressPercent').textContent = `${s.percent}%`; $('#progressFill').style.width = `${s.percent}%`; $('#progressDetail').textContent = s.total ? `${s.completed} de ${s.total} concluídos` : 'Comece pelo próximo passo.'; $('#streakCount').textContent = `${streak()} ${streak() === 1 ? 'dia' : 'dias'}`; $('#notesInput').value = day.notes || ''; renderTasks(day); renderHabits(day); }
function renderSettings() { const box = $('#habitSettings'); box.innerHTML = state.habitDefs.map(h => `<div class="item"><span class="item-title">${escapeText(h.title)}<span class="habit-meta">Meta: ${h.target === 1 ? 'concluir' : h.target}</span></span><button class="tiny-button" data-habit-edit="${h.id}" aria-label="Editar hábito">✎</button><button class="tiny-button" data-habit-delete="${h.id}" aria-label="Excluir hábito">×</button></div>`).join('') || '<p class="muted">Nenhum hábito cadastrado.</p>'; }
function renderHistory() { const entries = Object.entries(state.days).sort(([a],[b]) => b.localeCompare(a)); $('#historyList').innerHTML = entries.length ? entries.map(([key, day]) => { const s = getStats(day); return `<button class="history-row" data-history="${key}"><span class="history-date">${dateLabel(key)}</span><span class="muted">${s.taskDone}/${s.taskTotal} tarefas · ${s.percent}%</span></button>`; }).join('') : '<p class="muted">Seu histórico aparecerá aqui.</p>'; }
function renderAll() { renderToday(); renderSettings(); renderHistory(); save(); }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2200); }
function taskAction(e) { const day = ensureDay(), target = e.target, task = day.tasks.find(t => t.id === target.dataset.taskCheck || t.id === target.dataset.taskEdit || t.id === target.dataset.taskDelete); if (!task) return; if (target.dataset.taskCheck) task.done = target.checked; if (target.dataset.taskEdit) { const value = prompt('Editar tarefa:', task.title); if (value?.trim()) task.title = value.trim(); } if (target.dataset.taskDelete && confirm('Excluir esta tarefa?')) day.tasks = day.tasks.filter(t => t.id !== task.id); renderAll(); }
function habitAction(e) { const day = ensureDay(), target = e.target, hid = target.dataset.habitToggle || target.dataset.habitPlus || target.dataset.habitMinus; if (!hid) return; const h = state.habitDefs.find(x => x.id === hid), current = day.habits[hid] || 0; if (target.dataset.habitToggle) day.habits[hid] = target.checked ? h.target : 0; if (target.dataset.habitPlus) day.habits[hid] = Math.min(h.target, current + 1); if (target.dataset.habitMinus) day.habits[hid] = Math.max(0, current - 1); renderAll(); }
function showHistory(key) { const day = state.days[key], s = getStats(day), detail = $('#historyDetail'); detail.hidden = false; detail.innerHTML = `<h2>${dateLabel(key, true)}</h2><p class="muted">${s.percent}% concluído · ${s.taskDone}/${s.taskTotal} tarefas</p><h3>TAREFAS</h3><ul>${day.tasks.map(t => `<li>${t.done ? '✓' : '○'} ${escapeText(t.title)}</li>`).join('') || '<li>Sem tarefas</li>'}</ul><h3>HÁBITOS</h3><ul>${state.habitDefs.map(h => `<li>${escapeText(h.title)} — ${day.habits[h.id] || 0}/${h.target}</li>`).join('') || '<li>Sem hábitos</li>'}</ul><h3>NOTAS</h3><p class="muted">${escapeText(day.notes || 'Sem notas.').replace(/\n/g, '<br>')}</p>`; detail.scrollIntoView({ behavior:'smooth', block:'nearest' }); }
state = load();
// Migra dados salvos pela versão antiga: ela podia criar o dia seguinte cedo
// por usar UTC. Só ocorre quando o dia local ainda não existe.
if (state.version === 1) {
  const localToday = todayKey();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const incorrectTomorrow = dateKey(tomorrow);
  if (!state.days[localToday] && state.days[incorrectTomorrow]) {
    state.days[localToday] = state.days[incorrectTomorrow];
    delete state.days[incorrectTomorrow];
  }
  state.version = 2;
}
ensureDay(); renderAll();
$('#addTask').onclick = () => { $('#taskForm').hidden = !$('#taskForm').hidden; if (!$('#taskForm').hidden) $('#taskInput').focus(); };
$('#taskForm').onsubmit = e => { e.preventDefault(); const title = $('#taskInput').value.trim(); if (!title) return; ensureDay().tasks.push({id:id(), title, done:false}); $('#taskInput').value=''; $('#taskForm').hidden=true; renderAll(); };
$('#taskList').onclick = taskAction; $('#taskList').onchange = taskAction; $('#habitList').onclick = habitAction; $('#habitList').onchange = habitAction;
$('#notesInput').oninput = e => { ensureDay().notes = e.target.value; save(); };
document.querySelectorAll('.tab').forEach(tab => tab.onclick = () => { document.querySelectorAll('.tab,.view').forEach(x => x.classList.remove('active')); tab.classList.add('active'); $(`#${tab.dataset.view}`).classList.add('active'); if (tab.dataset.view === 'historyView') renderHistory(); });
$('#historyList').onclick = e => { const row = e.target.closest('[data-history]'); if (row) showHistory(row.dataset.history); };
$('#addHabit').onclick = () => { $('#habitForm').hidden = !$('#habitForm').hidden; if (!$('#habitForm').hidden) $('#habitTitle').focus(); };
$('#habitForm').onsubmit = e => { e.preventDefault(); const title=$('#habitTitle').value.trim(), target=Number($('#habitTarget').value); if (!title || !target) return; state.habitDefs.push({id:id(),title,target}); $('#habitTitle').value=''; $('#habitTarget').value=1; $('#habitForm').hidden=true; renderAll(); };
$('#habitSettings').onclick = e => { const hid=e.target.dataset.habitDelete || e.target.dataset.habitEdit, h=state.habitDefs.find(x=>x.id===hid); if(!h)return; if(e.target.dataset.habitDelete && confirm(`Excluir o hábito "${h.title}"?`)) { state.habitDefs=state.habitDefs.filter(x=>x.id!==hid); renderAll(); } if(e.target.dataset.habitEdit) { const title=prompt('Nome do hábito:',h.title); if(title?.trim()) { h.title=title.trim(); const target=prompt('Meta numérica (1 para apenas concluir):',h.target); if(target && Number(target)>0) h.target=Number(target); renderAll(); } } };
$('#exportData').onclick = () => { const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}), a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`foco-backup-${todayKey()}.json`; a.click(); URL.revokeObjectURL(a.href); toast('Backup exportado.'); };
$('#importData').onchange = e => { const file=e.target.files[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{try { const data=JSON.parse(reader.result); if(![1,2].includes(data?.version) || !data.days || !Array.isArray(data.habitDefs)) throw Error(); state=data; ensureDay(); renderAll(); toast('Backup importado com sucesso.'); } catch { toast('Este arquivo não parece ser um backup válido.'); }}; reader.readAsText(file); e.target.value=''; };
$('#clearData').onclick = () => { if(confirm('Isso apagará todas as tarefas, hábitos e notas salvas neste aparelho. Continuar?')) { state=defaults(); ensureDay(); renderAll(); toast('Dados apagados.'); }};
let installPrompt; window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt=e; $('#installButton').hidden=false; }); $('#installButton').onclick=async()=>{if(!installPrompt)return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt=null; $('#installButton').hidden=true;};
if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
