// ════════════════════════════════════════════════════════════════════════════
// BOTWAVEBOMBA — theme.js
// Two themes only: light, dark.
// Defaults to prefers-color-scheme. Persists manual override to localStorage.
// ════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'botwavebomba-theme';
const VALID_THEMES = ['light', 'dark'];

function getStoredTheme() {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (VALID_THEMES.includes(t)) return t;
  } catch (e) { /* localStorage blocked */ }
  return null;
}

function getSystemTheme() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function applyTheme(theme) {
  if (!VALID_THEMES.includes(theme)) theme = 'light';
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-bwb-theme', theme);
  // Update theme-color meta for mobile chrome
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0D0D0D' : '#FAFAF7');
  }
  // Update toggle button label
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
    btn.setAttribute('data-current-theme', theme);
    const label = btn.querySelector('.theme-toggle-label');
    if (label) label.textContent = theme === 'dark' ? '☽ DARK' : '☀ LIGHT';
  }
}

function setTheme(theme) {
  if (!VALID_THEMES.includes(theme)) return;
  try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* ignore */ }
  applyTheme(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(current === 'dark' ? 'light' : 'dark');
}

// ── INIT ──
// Apply theme before any other JS runs to prevent FOUC.
// Order: localStorage > prefers-color-scheme > light default.
(function initTheme() {
  const stored = getStoredTheme();
  const theme = stored || getSystemTheme();
  applyTheme(theme);
})();

// ── WIRE TOGGLE BUTTON + SYSTEM CHANGES ──
document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.addEventListener('click', toggleTheme);

  // Listen for system theme changes (only applies if user hasn't set override)
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = function (e) {
      if (!getStoredTheme()) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
  }
});

// Expose for inline scripts
window.BWB_Theme = { set: setTheme, get: () => document.documentElement.getAttribute('data-theme'), toggle: toggleTheme };
