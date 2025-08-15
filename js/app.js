// Notegood · Malla Psicología (Udelar Montevideo)
// - Carga desde materias_psico.json
// - Bloqueo/desbloqueo por previaturas
// - Guarda progreso (aprobadas/cursando) en localStorage
// - Render por columnas (1º a 8º sem + extra)
// - Flow Notegood: frases, progreso, toasts lindos y confetti :)

const DATA_URL = "../materias_psico.json";
const LS_STATE = "malla-psico-state-v1";

const state = {
  aprobadas: new Set(),
  cursando: new Set(),
  data: { areas: [], materias: [] },
  byCodigo: new Map(),
};

// --- Frases motivacionales (rotan)
const QUOTES = [
  "“La vida no es lo que te pasa, sino cómo respondes a ello.” — Epicteto",
  "“Nada está perdido si se tiene el valor de proclamar que todo está perdido y hay que empezar de nuevo.” — Julio Cortázar",
  "“No vemos las cosas como son, las vemos como somos.” — Anaïs Nin",
  "“El éxito es la suma de pequeños esfuerzos repetidos día tras día.” — Robert Collier",
  "“Donde tus talentos y las necesidades del mundo se cruzan, ahí está tu vocación.” — Aristóteles",
  "“Si no puedes volar, corre; si no puedes correr, camina; pero sigue adelante.” — Martin Luther King Jr.",
  "“Cambiar es difícil al principio, caótico en el medio y precioso al final.” — Robin Sharma",
  "“La motivación te pone en marcha, el hábito te mantiene.” — Jim Ryun"
];

function setRandomQuote() {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  const box = document.getElementById("quote-box");
  if (box) box.textContent = q;
}

// ---- Storage helpers
function loadState() {
  try {
    const raw = localStorage.getItem(LS_STATE);
    if (!raw) return;
    const obj = JSON.parse(raw);
    state.aprobadas = new Set(obj.aprobadas || []);
    state.cursando = new Set(obj.cursando || []);
  } catch {}
}
function saveState() {
  const obj = {
    aprobadas: [...state.aprobadas],
    cursando: [...state.cursando],
  };
  localStorage.setItem(LS_STATE, JSON.stringify(obj));
}
export function resetState() {
  localStorage.removeItem(LS_STATE);
  state.aprobadas.clear();
  state.cursando.clear();
}

// ---- Utils DOM
const $ = (sel) => document.querySelector(sel);
const container = $("#malla-container");

function toast(msg, ms = 1800) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  // animate in/out
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, ms);
}

function confettiBurst(x = window.innerWidth / 2, y = 80) {
  const n = 22;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i");
    p.className = "confetti";
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    const angle = (Math.PI * 2 * i) / n;
    const speed = 2 + Math.random() * 3;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 2;
    p.style.setProperty("--vx", vx);
    p.style.setProperty("--vy", vy);
    p.style.background = i % 2 ? "var(--brand)" : "var(--brand-2)";
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
}

// ---- App init
async function init() {
  loadState();
  setRandomQuote();
  setInterval(setRandomQuote, 12000);

  const res = await fetch(DATA_URL);
  const data = await res.json();
  state.data = data;
  state.byCodigo = new Map(data.materias.map(m => [m.codigo, m]));

  renderLegend();
  renderGrid();
  updateProgress();

  // Toolbar
  $("#toggle-cursando")?.addEventListener("change", () => { renderGrid(); });
  $("#toggle-bloqueadas")?.addEventListener("change", () => { renderGrid(); });
  $("#search")?.addEventListener("input", () => { renderGrid(); });

  $("#btn-clear")?.addEventListener("click", () => {
    if (confirm("¿Seguro que querés borrar tu avance?")) {
      resetState();
      renderGrid();
      updateProgress();
      toast("Avance reiniciado ✨");
    }
  });

  // Export/Import son opcionales; si no existen, no pasa nada
  $("#btn-export")?.addEventListener("click", exportProgress);
  $("#btn-import")?.addEventListener("click", importProgress);
}

function renderLegend() {
  const wrap = $("#legend");
  if (!wrap) return;
  wrap.innerHTML = "";
  state.data.areas.forEach(a => {
    const chip = document.createElement("div");
    chip.className = "chip";
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = a.color;
    chip.appendChild(sw);
    const txt = document.createElement("span");
    txt.textContent = a.nombre;
    chip.appendChild(txt);
    wrap.appendChild(chip);
  });
}

// Group by semestre (1..8, 9="Extras")
function renderGrid() {
  const showCurs = $("#toggle-cursando")?.checked ?? true;
  const showLocked = $("#toggle-bloqueadas")?.checked ?? true;
  const q = ($("#search")?.value || "").toLowerCase();

  // Columns
  const cols = new Map();
  for (let s = 1; s <= 8; s++) cols.set(s, []);
  cols.set(9, []); // extras/optativas

  // Filter + assign
  const items = state.data.materias.slice().filter(m => {
    if (q && !(`${m.nombre} ${m.codigo}`.toLowerCase().includes(q))) return false;
    return true;
  });

  items.forEach(m => {
    const s = Number(m.semestre) >= 1 && Number(m.semestre) <= 8 ? Number(m.semestre) : 9;
    cols.get(s).push(m);
  });

  // Sort by area then name
  for (const arr of cols.values()) {
    arr.sort((a,b) => (a.area || "").localeCompare(b.area || "") || a.nombre.localeCompare(b.nombre));
  }

  container.innerHTML = "";
  let totalRendered = 0;

  for (const [sem, arr] of cols) {
    const col = document.createElement("div");
    col.className = "column";
    const title = document.createElement("h3");
    title.className = "col-title";
    title.textContent = sem === 9 ? "Extras / Optativas / Prácticas" : `${sem}º semestre`;
    col.appendChild(title);

    arr.forEach(m => {
      const locked = !checkUnlocked(m);
      const isAprob = state.aprobadas.has(m.codigo);
      const isCurs = state.cursando.has(m.codigo);

      if (!showLocked && locked && !isAprob && !isCurs) return;
      if (!showCurs && isCurs) return;

      totalRendered++;

      const card = document.createElement("div");
      card.className = "card-materia";
      if (locked && !isAprob && !isCurs) card.classList.add("locked");

      // header
      const head = document.createElement("div");
      head.className = "header";
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = colorForArea(m.area);
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = m.codigo;
      const t = document.createElement("div");
      t.className = "title";
      t.textContent = m.nombre;

      head.append(dot, badge, t);

      // meta
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = [
        areaName(m.area),
        m.creditos ? `· ${m.creditos} cr.` : "",
        m.semestre ? `· S${m.semestre}` : ""
      ].filter(Boolean).join(" ");

      // tags
      const tags = document.createElement("div");
      tags.className = "tags";
      if (isAprob) addTag(tags, "APROBADA ✅");
      if (isCurs) addTag(tags, "CURSANDO ⏳");
      if (locked && !isAprob && !isCurs) addTag(tags, "BLOQUEADA 🔒");

      // state buttons
      const bar = document.createElement("div");
      bar.className = "statebar";
      const b1 = document.createElement("button");
      b1.className = "state-ok";
      b1.textContent = isAprob ? "✓ Marcada aprobada" : "Marcar aprobada";
      b1.addEventListener("click", (ev) => {
        const before = state.aprobadas.has(m.codigo);
        toggleAprobada(m.codigo);
        renderGrid();
        updateProgress();
        if (!before && state.aprobadas.has(m.codigo)) {
          // mensajes simpáticos
          const msgs = [
            "¡Otra tachada! 💪",
            "Sumaste progreso, crack ✨",
            "Paso a paso, ¡pero firmes! 🧠",
            "¡Bien ahí! Cada materia cuenta 💜",
            "Notegood vibra: ¡lo lograste! 🌈"
          ];
          toast(msgs[Math.floor(Math.random()*msgs.length)]);
          const rect = ev.target.getBoundingClientRect();
          confettiBurst(rect.left + rect.width/2, rect.top + window.scrollY);
        }
      });

      const b2 = document.createElement("button");
      b2.className = "state-warn";
      b2.textContent = isCurs ? "⏳ Marcada cursando" : "Marcar cursando";
      b2.addEventListener("click", () => {
        toggleCursando(m.codigo);
        renderGrid();
        toast("¡A cursar se ha dicho! 📚");
      });

      const b3 = document.createElement("button");
      b3.className = "state-locked";
      b3.textContent = "Ver requisitos";
      b3.addEventListener("click", () => {
        const faltan = faltantes(m).map(c => state.byCodigo.get(c)?.nombre || c);
        alert(faltan.length ? `Te falta(n):\n• ${faltan.join("\n• ")}` : "No tiene previaturas.");
      });

      bar.append(b1,b2,b3);

      // tooltip
      const tip = document.createElement("div");
      tip.className = "tooltip";
      tip.innerHTML = tooltipHtml(m);

      card.append(head, meta, tags, bar, tip);
      col.appendChild(card);
    });

    container.appendChild(col);
  }

  if (totalRendered === 0) {
    const empty = document.createElement("div");
    empty.className = "card";
    empty.style.gridColumn = "1 / -1";
    empty.innerHTML = `🤔 No hay materias que coincidan con tu búsqueda.<br>
    <span class="muted">Probá borrar el texto o revisar los filtros.</span>`;
    container.appendChild(empty);
  }
}

function addTag(parent, text) {
  const el = document.createElement("span");
  el.className = "tag";
  el.textContent = text;
  parent.appendChild(el);
}

function areaName(code){
  const a = state.data.areas.find(x => x.codigo === code);
  return a ? a.nombre : code;
}
function colorForArea(code){
  const a = state.data.areas.find(x => x.codigo === code);
  return a ? a.color : "#666";
}

// A course is unlocked if all its previaturas are approved
function checkUnlocked(m) {
  const req = m.previaturas || [];
  return req.every(c => state.aprobadas.has(c));
}
function faltantes(m){
  const req = m.previaturas || [];
  return req.filter(c => !state.aprobadas.has(c));
}

function toggleAprobada(cod) {
  if (state.aprobadas.has(cod)) {
    state.aprobadas.delete(cod);
  } else {
    state.aprobadas.add(cod);
    // if you approve, remove "cursando"
    state.cursando.delete(cod);
  }
  saveState();
}
function toggleCursando(cod) {
  if (state.cursando.has(cod)) {
    state.cursando.delete(cod);
  } else {
    state.cursando.add(cod);
  }
  saveState();
}

function tooltipHtml(m) {
  const prev = (m.previaturas || []).map(c=> state.byCodigo.get(c)?.nombre || c);
  return `
    <strong>${m.nombre}</strong><br/>
    <em>${areaName(m.area)}</em> · ${m.creditos || "-"} cr. · S${m.semestre || "-"}<br/>
    <hr style="border-color:#222635">
    <div><strong>Previaturas:</strong> ${prev.length ? prev.join("; ") : "—"}</div>
    <div style="margin-top:4px;color:var(--muted)">Tip: marcá lo del ciclo inicial para destrabar más materias.</div>
  `;
}

// Export / Import (no usados si no hay botones)
function exportProgress(){
  const payload = {
    when: new Date().toISOString(),
    aprobadas: [...state.aprobadas],
    cursando: [...state.cursando],
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "avance_psico.json";
  a.click();
  URL.revokeObjectURL(url);
}
function importProgress(){
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "application/json";
  inp.onchange = async () => {
    const file = inp.files[0];
    if (!file) return;
    const txt = await file.text();
    try{
      const obj = JSON.parse(txt);
      state.aprobadas = new Set(obj.aprobadas || []);
      state.cursando = new Set(obj.cursando || []);
      saveState();
      renderGrid();
      updateProgress();
      toast("Avance importado.");
    }catch(e){
      alert("Archivo inválido.");
    }
  };
  inp.click();
}

// ---- Progreso general
function updateProgress(){
  const total = state.data.materias.filter(m => m.creditos !== 0 && m.semestre <= 8).length;
  const aprob = state.aprobadas.size;
  const pct = total ? Math.round((aprob/total)*100) : 0;

  const bar = $("#progress-bar");
  const label = $("#progress-label");
  const msg = $("#progress-msg");
  if (!bar || !label || !msg) return;

  bar.style.width = pct + "%";
  label.textContent = `${aprob}/${total} (${pct}%)`;

  if (pct === 0) msg.textContent = "¡Primer paso listo! Sumá tu primera materia 😊";
  else if (pct < 25) msg.textContent = "Buen comienzo, constancia mata talento 💜";
  else if (pct < 50) msg.textContent = "¡Ya se siente el avance! Seguimos 🧠";
  else if (pct < 75) msg.textContent = "Más de la mitad, enorme 👏";
  else if (pct < 100) msg.textContent = "Último tramo, ¡a fondo! 🚀";
  else msg.textContent = "¡Malla completada! Te esperamos en el Parque Batlle a festejar 😜";
}

document.addEventListener("DOMContentLoaded", init);
