// ── Main Entry Point ──
// Load critical JS first, then lazy-load the rest.
(function() {
  // Load theme.js first (critical for dark/light mode)
  const themeScript = document.createElement('script');
  themeScript.src = '/botwavebomba/assets/js/theme.js?v=2';
  themeScript.defer = true;
  document.head.appendChild(themeScript);

  // Lazy-load other modules
  function loadScript(src) {
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  }

  // Load article-analyzer.js after a short delay
  setTimeout(() => {
    loadScript('/botwavebomba/assets/js/article-analyzer.js?v=2');
  }, 1000);

  // Initialize the feed
  loadScript('/botwavebomba/assets/js/feed.js?v=2');
})();