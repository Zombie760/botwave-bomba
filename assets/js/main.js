// ── Main Entry Point v4 ──
// Loads the site chrome, data adapter, and feed renderer in order.
(function () {
  const BASE = window.BWB_BASE || '/botwavebomba';

  function loadScript(src) {
    const script = document.createElement('script');
    script.src = BASE + src;
    script.defer = true;
    document.head.appendChild(script);
  }

  // Critical path: theme, chrome, data adapter, feed renderer.
  loadScript('/assets/js/theme.js?v=4');
  loadScript('/assets/js/min/site-chrome.js?v=4');
  loadScript('/assets/js/api-adapter.js?v=4');
  loadScript('/assets/js/feed.js?v=4');
})();