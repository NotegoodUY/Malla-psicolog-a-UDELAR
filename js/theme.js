// Tiny theme switcher (persists in localStorage)
const THEME_KEY = "ng-theme";

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved || "light"; // por defecto: claro
  applyTheme(theme);
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "light" ? "dark" : "light");
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  const btn = document.getElementById("btn-theme");
  if (btn) btn.textContent = theme === "light" ? "🌙 Oscuro" : "☀️ Claro";
}
