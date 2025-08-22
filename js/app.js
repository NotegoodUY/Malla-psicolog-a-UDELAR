// js/app.js
// Lógica de malla: carga JSON, render, previaturas y progreso
const SAVE_KEY = 'ng-psico-progress';
const DATA_URL = "../materias_psico.json"; // JSON en raíz

// Estado
const progress = {
  approved: new Set(),
  taking: new Set(),
};
const options = {
  showTaking: false,
  showLocked: true,
  search: '',
};

// Helpers
const byId = (id) => document.getElementById(id);
const grid = () => byId('grid');

function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    (raw.approved || []).forEach(id => progress.approved.add(String(id)));
    (raw.taking || []).forEach(id => progress.taking.add(String(id)));
  } catch {}
}
function saveProgress() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    approved: [...progress.approved],
    taking:   [...progress.taking],
  }));
}

function normalizeMateria(m) {
  const nombre = m.nombre || m.name || m.titulo || 'Materia';
  const idBase = m.id || m.codigo || m.code || nombre;
  const id = String(idBase).toLowerCase().replace(/\s+/g, '-');
  const semestre = Number(m.semestre ?? m.semester ?? m.cuatrimestre ?? m.nivel ?? 0);
  const area = m.area || m.modulo || m.módulo || 'General';
  const previas = (m.previas || m.prerrequisitos || m.reqs || []).map(x => String(x).toLowerCase().replace(/\s+/g,'-'));
  const creditos = m.creditos ?? m.créditos ?? m.credits ?? null;
  return { id, nombre, semestre, area, previas, creditos, raw: m };
}

function isUnlocked(m) {
  // Desbloquea si TODAS sus previas están aprobadas o cursándose
  return m.previas.every(pid => progress.approved.has(pid) || progress.taking.has(pid));
}

function matchesSearch(m, q) {
  if (!q) return true;
  q = q.toLowerCase().trim();
  return m.nombre.toLowerCase().includes(q) || m.area.toLowerCase().includes(q) || m.id.includes(q);
}

function createColumn(title) {
  const col = document.createElement('div');
  col.className = 'column';
  const h = document.createElement('div');
  h.className = 'col-title';
  h.textContent = title;
  col.appendChild(h);
  return col;
}

function materiaCard(m) {
  const isApproved = progress.approved.has(m.id);
  const isTaking = progress.taking.has(m.id);
  const locked = !isUnlocked(m) && !isApproved && !isTaking;

  const el = document.createElement('div');
  el.className = 'card-materia' + (locked ? ' locked' : '');
  el.dataset.mid = m.id;

  const head = document.createElement('div'); head.className = 'header';
  const ttl = document.createElement('div'); ttl.className = 'title'; ttl.textContent = m.nombre;
  head.appendChild(ttl);

  const meta = document.createElement('div'); meta.className = 'meta';
  meta.textContent = `${m.area}${m.creditos ? ` • ${m.creditos} créditos` : ''}`;

  const tags = document.createElement('div'); tags.className = 'tags';
  const t = document.createElement('span'); t.className = 'tag';
  t.textContent = m.previas.length ? `Previa(s): ${m.previas.join(', ')}` : 'Sin previaturas';
  tags.appendChild(t);

  const statebar = document.createElement('div'); statebar.className = 'statebar';
  const b1 = document.createElement('button'); b1.textContent = 'Aprobada'; b1.className='state-ok';
  const b2 = document.createElement('button'); b2.textContent = 'Cursando'; b2.className='state-warn';
  const b3 = document.createElement('button'); b3.textContent = 'Quitar';   b3.className='state-locked';
  b1.onclick = () => { progress.approved.add(m.id); progress.taking.delete(m.id); saveProgress(); render(); };
  b2.onclick = () => { progress.taking.add(m.id); progress.approved.delete(m.id); saveProgress(); render(); };
  b3.onclick = () => { progress.approved.delete(m.id); progress.taking.delete(m.id); saveProgress(); render(); };
  statebar.append(b1,b2,b3);

  const tip = document.createElement('div'); tip.className='tooltip';
  if (locked && m.previas.length) tip.textContent = 'Bloqueada. Necesitas: ' + m.previas.join(', ');
  else if (isApproved)           tip.textContent = 'Marcada como aprobada.';
  else if (isTaking)             tip.textContent = 'Marcada como cursando.';
  else                           tip.textContent = 'Disponible.';

  el.append(head, meta, tags, statebar, tip);

  // Filtros visuales
  if (!options.showLocked && locked) el.style.display = 'none';
  if (!options.showTaking && isTaking) el.style.display = 'none';
  if (!matchesSearch(m, options.search)) el.style.display = 'none';

  return el;
}

function renderGrid(materias) {
  const root = grid();
  root.innerHTML = '';

  // columnas 1..8 + Extras
  const cols = new Map();
  for (let s=1; s<=8; s++) cols.set(String(s), createColumn(`${s}.º`));
  cols.set('extras', createColumn('Extras'));

  materias.forEach(m => {
    const k = (m.semestre >=1 && m.semestre <=8) ? String(m.semestre) : 'extras';
    cols.get(k).appendChild(materiaCard(m));
  });

  // Montar
  for (let s=1; s<=8; s++) root.appendChild(cols.get(String(s)));
  root.appendChild(cols.get('extras'));
}

// ---- Init principal ----
let ALL = [];

export async function initMalla() {
  // Theme se maneja desde theme.js
  // Controles
  byId('btn-reset')?.addEventListener('click', () => {
    if (confirm('¿Reiniciar tu progreso guardado?')) {
      localStorage.removeItem(SAVE_KEY);
      progress.approved.clear();
      progress.taking.clear();
      render();
    }
  });
  byId('showTaking')?.addEventListener('change', e => { options.showTaking = e.target.checked; render(); });
  byId('showLocked')?.addEventListener('change', e => { options.showLocked = e.target.checked; render(); });
  byId('search')?.addEventListener('input', e => { options.search = e.target.value; render(); });

  loadProgress();

  // Cargar materias
  const res = await fetch(DATA_URL);
  const data = await res.json();
  const arr = Array.isArray(data) ? data : (data.materias || data.items || []);
  ALL = arr.map(normalizeMateria);

  render();
}

function render() { renderGrid(ALL); }
