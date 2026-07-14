// BotwaveBomba shared client runtime
(function () {
  'use strict';

  const BASE = window.BWB_BASE || '/botwavebomba';
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  function url(path) {
    if (path.startsWith('http') || path.startsWith(BASE)) return path;
    return BASE + (path.startsWith('/') ? path : '/' + path);
  }
  window.BWB_URL = url;

  // Theme toggle
  const themeBtn = $('#themeToggle');
  function setTheme(theme) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (themeBtn) themeBtn.innerHTML = '<span aria-hidden="true">' + (theme === 'dark' ? '🌙' : '☀️') + '</span>';
    try { localStorage.setItem('bwb-theme', theme); } catch (e) {}
  }
  if (themeBtn) {
    const saved = (() => { try { return localStorage.getItem('bwb-theme'); } catch (e) { return null; } })();
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved || (systemDark ? 'dark' : 'light');
    setTheme(initial);
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // Mobile nav
  const menuToggle = $('#menuToggle');
  const primaryNav = $('#primaryNav');
  if (menuToggle && primaryNav) {
    menuToggle.addEventListener('click', () => {
      const open = primaryNav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
    });
  }

  // Current page marker
  const currentPath = location.pathname.replace(BASE, '').replace(/^\//, '') || 'index.html';
  $$('.bwb-primary-nav a').forEach(a => {
    const href = a.getAttribute('href') || '';
    const page = href.replace(BASE, '').replace(/^\//, '');
    if (page === currentPath || (currentPath === '' && page === 'index.html')) {
      a.setAttribute('aria-current', 'page');
    }
  });

  // Expand source lists
  $$('.bwb-card-expand').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-expand');
      const panel = document.getElementById('sources-' + id);
      if (!panel) return;
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      panel.hidden = expanded;
      btn.textContent = (expanded ? 'Show ' : 'Hide ') + btn.getAttribute('data-count') + ' sources';
    });
  });

  // Section/filter pills (homepage)
  $$('.bwb-filter-btn[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter');
      $$('.bwb-filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.bwb-story-card').forEach(card => {
        if (filter === 'all') { card.hidden = false; return; }
        const filters = (card.getAttribute('data-filters') || '').split(/\s+/).filter(Boolean);
        card.hidden = !filters.includes(filter);
      });
    });
  });

  // Search overlay
  const searchToggle = $('#searchToggle');
  const searchOverlay = $('#searchOverlay');
  const searchClose = $('#searchClose');
  const siteSearch = $('#siteSearch');
  const searchResults = $('#searchResults');

  async function loadIndex() {
    try {
      const res = await fetch(url('/api/search_index.json'));
      if (!res.ok) return [];
      return await res.json();
    } catch (e) { return []; }
  }

  let searchIndex = null;
  if (searchToggle && searchOverlay) {
    searchToggle.addEventListener('click', async () => {
      searchOverlay.hidden = false;
      siteSearch?.focus();
      if (!searchIndex) searchIndex = await loadIndex();
    });
    searchClose?.addEventListener('click', () => { searchOverlay.hidden = true; });
    searchOverlay.addEventListener('click', (e) => {
      if (e.target === searchOverlay) searchOverlay.hidden = true;
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && searchOverlay) searchOverlay.hidden = true;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchOverlay.hidden = false;
        siteSearch?.focus();
      }
    });

    siteSearch?.addEventListener('input', () => {
      const q = siteSearch.value.trim().toLowerCase();
      if (!q || !searchResults) return;
      if (!searchIndex) { searchResults.innerHTML = '<p class="bwb-search-empty">Loading search index…</p>'; return; }
      const matches = searchIndex.filter(item =>
        (item.title || '').toLowerCase().includes(q) ||
        (item.excerpt || '').toLowerCase().includes(q) ||
        (item.source || '').toLowerCase().includes(q) ||
        (item.country || '').toLowerCase().includes(q) ||
        (item.section || '').toLowerCase().includes(q)
      ).slice(0, 10);
      if (!matches.length) {
        searchResults.innerHTML = '<p class="bwb-search-empty">No stories found.</p>';
        return;
      }
      searchResults.innerHTML = matches.map(m => `
        <a class="bwb-search-result" href="${url('/sigint.html?id=' + encodeURIComponent(m.id))}">
          <h4>${escapeHtml(m.title)}</h4>
          <p>${escapeHtml(m.source || m.section || '')} · ${escapeHtml(m.excerpt || '').slice(0, 120)}</p>
        </a>
      `).join('');
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // Service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(url('/service-worker.js'))
        .then(() => console.log('[bwb] sw registered'))
        .catch(e => console.error('[bwb] sw failed', e));
    });
  }
})();
