// BotwaveBomba SEARCH page driver
// Region-aware full-text search + interactive coverage map.
// No external map SDK — Canvas world map built from the site's own coverage data.
(function () {
  const BASE = window.BWB_BASE || "/botwavebomba";
  const DATA = window.BWB_SEARCH_DATA || { countries: {}, maxCount: 1, searchIndexUrl: BASE + "/api/search_index.json" };
  const $ = (s) => document.querySelector(s);

  function url(p) {
    if (p.startsWith("http") || p.startsWith(BASE)) return p;
    return BASE + (p.startsWith("/") ? p : "/" + p);
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  // Country centroids keyed by ISO-3166 alpha-2 code (matches source.country in dataset)
  const CENTROIDS = {
    AU: [-25.27, 133.77], GB: [55.37, -3.43], GH: [7.94, -1.02], IN: [20.59, 78.96],
    IR: [32.42, 53.68], JP: [36.2, 138.25], KR: [35.9, 127.76], MZ: [-18.66, 35.53],
    NG: [9.08, 8.67], NZ: [-40.9, 174.89], PH: [12.87, 121.77], PK: [30.37, 69.34],
    QA: [25.35, 51.18], RU: [61.52, 105.31], TW: [23.7, 120.96], US: [37.09, -95.71],
  };
  const COUNTRY_NAMES = {
    AU: "Australia", GB: "United Kingdom", GH: "Ghana", IN: "India", IR: "Iran",
    JP: "Japan", KR: "South Korea", MZ: "Mozambique", NG: "Nigeria", NZ: "New Zealand",
    PH: "Philippines", PK: "Pakistan", QA: "Qatar", RU: "Russia", TW: "Taiwan", US: "United States",
  };
  const countryName = (code) => COUNTRY_NAMES[code] || code;

  const project = (lat, lon, w, h) => ({
    x: ((lon + 180) / 360) * w,
    y: (1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2 * h,
  });

  const input = $("#bwbSearchInput");
  const regionSelect = $("#bwbRegionSelect");
  const regionClear = $("#bwbRegionClear");
  const stats = $("#bwbSearchStats");
  const results = $("#bwbSearchResults");
  const canvas = $("#bwbSearchMap");

  let miniSearch = null;
  let allDocs = [];
  let activeRegion = "";

  async function init() {
    // Draw the coverage map immediately from inlined country data (no fetch needed).
    drawMap();
    relabelRegions();
    // Relabel + initial render can happen before the index loads.
    render(null, "Loading search index…");
    try {
      const res = await fetch(url(DATA.searchIndexUrl));
      allDocs = await res.json();
      const mod = (await import(/* @vite-ignore */ url("/assets/js/minisearch.js"))).default;
      const MiniSearch = mod.default || mod;
      miniSearch = new MiniSearch({
        fields: ["title", "excerpt", "asset", "country", "theaters", "assets"],
        storeFields: ["id", "title", "excerpt", "asset", "country", "theaters", "alignment"],
        extractField: (doc, field) => {
          const v = doc[field];
          return Array.isArray(v) ? v.join(" ") : (v ?? "");
        },
      });
      miniSearch.addAll(allDocs);
      render(null, "");
    } catch (e) {
      console.error("[search-page] index load failed", e);
      render(null, "Search index unavailable — map filter still works by region.");
    }
    wire();
  }

  function relabelRegions() {
    if (regionSelect) {
      Array.from(regionSelect.options).forEach((opt) => {
        if (opt.value) opt.textContent = countryName(opt.value);
      });
    }
  }

  function filteredDocs(q) {
    let docs = allDocs;
    if (q && miniSearch) {
      const ids = new Set(miniSearch.search(q, { fuzzy: 0.2, prefix: true, boost: { title: 2 } }).map((m) => m.id));
      docs = allDocs.filter((d) => ids.has(d.id));
    }
    if (activeRegion) {
      docs = docs.filter(
        (d) => d.country === activeRegion || (d.theaters || []).includes(activeRegion)
      );
    }
    return docs;
  }

  function render(q, note) {
    const docs = filteredDocs(q);
    const sorted = [...docs].sort((a, b) => (b.theaters?.length || 0) - (a.theaters?.length || 0));
    stats.textContent = note
      ? note
      : `${sorted.length} intercept${sorted.length === 1 ? "" : "s"}${activeRegion ? " in " + countryName(activeRegion) : ""}${q ? ' matching "' + q + '"' : ""}`;
    if (!sorted.length) {
      results.innerHTML = '<p class="bwb-search-empty">No intercepts match this filter.</p>';
      return;
    }
    results.innerHTML = sorted
      .slice(0, 60)
      .map((d) => {
        const blocs = (d.theaters || []).slice(0, 4).map(countryName).join(" · ") || countryName(d.country) || "—";
        return `<a class="bwb-search-card" href="${url("/sigint.html?id=" + encodeURIComponent(d.id))}">
          <h4>${escapeHtml(d.title)}</h4>
          <p class="bwb-search-card-meta">${escapeHtml(d.asset || countryName(d.country) || "")} · ${escapeHtml(blocs)}</p>
          <p class="bwb-search-card-excerpt">${escapeHtml((d.excerpt || "").slice(0, 160))}</p>
        </a>`;
      })
      .join("");
  }

  function drawMap() {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = (canvas.width = canvas.clientWidth || 1000);
    const h = (canvas.height = 500);
    ctx.fillStyle = "#0f1419";
    ctx.fillRect(0, 0, w, h);
    // graticule-ish filler
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    for (let x = 0; x <= w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    for (const [country, info] of Object.entries(DATA.countries)) {
      const c = CENTROIDS[country];
      if (!c) continue;
      const pos = project(c[0], c[1], w, h);
      const intensity = Math.log1p(info.count) / Math.log1p(DATA.maxCount);
      const hue = (1 - intensity) * 240; // blue (cold) -> red (hot)
      ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.85)`;
      const r = Math.max(5, intensity * 22);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, 2 * Math.PI);
      ctx.fill();
      if (activeRegion === country) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r + 4, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  }

  function onMapClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    let best = null;
    let bestDist = Infinity;
    for (const [country, info] of Object.entries(DATA.countries)) {
      const c = CENTROIDS[country];
      if (!c) continue;
      const pos = project(c[0], c[1], canvas.width, canvas.height);
      const d = Math.hypot(pos.x - x, pos.y - y);
      if (d < bestDist) { bestDist = d; best = country; }
    }
    if (best && bestDist < 30) {
      activeRegion = activeRegion === best ? "" : best;
      if (regionSelect) regionSelect.value = activeRegion;
      drawMap();
      render(input?.value.trim() || "", "");
    }
  }

  function wire() {
    if (input) {
      input.addEventListener("input", () => render(input.value.trim() || "", ""));
    }
    if (regionSelect) {
      regionSelect.addEventListener("change", () => {
        activeRegion = regionSelect.value;
        drawMap();
        render(input?.value.trim() || "", "");
      });
    }
    if (regionClear) {
      regionClear.addEventListener("click", () => {
        activeRegion = "";
        if (regionSelect) regionSelect.value = "";
        drawMap();
        render(input?.value.trim() || "", "");
      });
    }
    if (canvas) {
      canvas.addEventListener("click", onMapClick);
      window.addEventListener("resize", drawMap);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
