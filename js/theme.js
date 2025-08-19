// Tema con persistencia (emoji-only)
const KEY = "ng-theme";

export function initTheme() {
  const saved = localStorage.getItem(KEY) || "light";
  document.documentElement.setAttribute("data-theme", saved);
  const btn = document.getElementById("btn-theme");
  if (btn) btn.textContent = saved === "light" ? "🌙" : "☀️";
}
export function toggleTheme() {
  const btn = document.getElementById("btn-theme");
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(KEY, next);
  if (btn) btn.textContent = next === "light" ? "🌙" : "☀️";
}
