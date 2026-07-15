// Story detail hydration — ground.news split-screen source comparison.
// Loads story by ?id= from api/stories_clustered.json, cross-references
// api/sources_real_seed.json for factuality/bias/tone, then renders:
//   - Factuality ribbon (top)
//   - Bias split bar (Western vs Non-Aligned vs Adversarial)
//   - 3-column source comparison (Western left, Non-Aligned center, Adversarial right)
//   - Inline source metadata (country, factuality, tone, paywall, bias)
//   - Coverage-gap / mono-frame / blackout signal badges
(function () {
  "use strict";

  const BASE = window.BWB_BASE || (() => {
    // Auto-detect base from script src or location
    const s = document.currentScript || document.querySelector('script[src*="story.js"]');
    if (s && s.src) {
      // e.g. /botwavebomba/assets/js/story.js?v=1 -> /botwavebomba
      const m = s.src.match(/^https?:\/\/[^/]+(\/[^/]+)\/assets\//);
      if (m) return m[1];
    }
    return "/botwavebomba";
  })();
  const mount = document.getElementById("story-detail-mount");
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  function url(path) {
    return path.startsWith("/") ? BASE + path : path;
  }
  function escapeHtml(s) {
    if (s == null) return "";
    return String(s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  }
  function normBloc(b) {
    const x = String(b || "other").toLowerCase();
    if (x.includes("western")) return "western";
    if (x.includes("non-aligned") || x.includes("nonaligned") || x === "neutral") return "non-aligned";
    if (x.includes("adversarial")) return "adversarial";
    return "other";
  }
  function getDomain(u) {
    if (!u) return "";
    try {
      return u.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
    } catch {
      return "";
    }
  }
  function factualityClass(f) {
    if (!f) return "unknown";
    const x = String(f).toLowerCase();
    if (x.includes("very-high") || x === "very_high") return "very-high";
    if (x.includes("very_low") || x.includes("very-low")) return "very-low";
    if (x.includes("high")) return "high";
    if (x.includes("low")) return "low";
    if (x.includes("mixed")) return "mixed";
    return "unknown";
  }
  function factualityLabel(f) {
    const c = factualityClass(f);
    return (
      {
        "very-high": "Very high",
        high: "High",
        mixed: "Mixed",
        low: "Low",
        "very-low": "Very low",
        unknown: "Unknown",
      }[c] || "Unknown"
    );
  }
  function timeAgo(iso) {
    if (!iso) return "";
    try {
      const t = new Date(iso).getTime();
      if (isNaN(t)) return "";
      const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
      if (s < 60) return "just now";
      if (s < 3600) return Math.floor(s / 60) + "m ago";
      if (s < 86400) return Math.floor(s / 3600) + "h ago";
      if (s < 604800) return Math.floor(s / 86400) + "d ago";
      return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  }

  let registryByDomain = {};

  function buildRegistry(sourcesArr) {
    const m = {};
    for (const s of sourcesArr || []) {
      if (s.domain) m[s.domain] = s;
      if (s.url) {
        try {
          const d = getDomain(s.url);
          if (d) m[d] = { ...m[d], ...s };
        } catch {}
      }
    }
    return m;
  }

  function renderStory(story) {
    const sources = (story.sources || []).map((s) => {
      const domain = getDomain(s.url);
      const reg = registryByDomain[domain] || {};
      return {
        ...s,
        domain,
        factuality: reg.factuality || reg.factfulness || "unknown",
        bias: reg.bias || "",
        tone: reg.tone || "",
        funding: reg.funding || "",
        paywall: reg.paywall || "",
        country: s.country || reg.country || "",
      };
    });

    const counts = { western: 0, "non-aligned": 0, adversarial: 0, other: 0 };
    for (const s of sources) counts[normBloc(s.bloc)]++;
    const total = sources.length || 1;
    const factTally = { "very-high": 0, high: 0, mixed: 0, low: 0, "very-low": 0, unknown: 0 };
    for (const s of sources) factTally[factualityClass(s.factuality)]++;

    // Signal detection
    const isCoverageGap = counts.western < 0.25 * total && total >= 3;
    const isMonoFrame = (counts.western > 0.85 * total || counts["non-aligned"] > 0.85 * total) && total >= 3;
    const isBlackout = counts.adversarial > 0.5 * total && counts.western < 0.15 * total;
    const signals = [];
    if (isCoverageGap) signals.push({ cls: "blindspot", label: "Coverage gap" });
    if (isMonoFrame) signals.push({ cls: "mono-frame", label: "Mono-frame" });
    if (isBlackout) signals.push({ cls: "blackout", label: "W. blackout" });

    // Source columns
    const byBloc = { western: [], "non-aligned": [], adversarial: [], other: [] };
    for (const s of sources) byBloc[normBloc(s.bloc)].push(s);

    const renderSourceCard = (s, headline) => {
      const bloc = normBloc(s.bloc);
      const fact = factualityClass(s.factuality);
      return `
      <article class="bwb-story-source-card ${bloc}">
        <header class="bwb-story-source-head">
          <div class="bwb-story-source-logo">
            <img src="https://logo.clearbit.com/${escapeHtml(s.domain)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
            <span class="bwb-story-source-logo-fb">${escapeHtml((s.name.match(/[A-Z]/g) || ["S"]).slice(0, 2).join(""))}</span>
          </div>
          <div class="bwb-story-source-meta">
            <div class="bwb-story-source-name">${escapeHtml(s.name)}</div>
            <div class="bwb-story-source-country">${escapeHtml(s.country || "")}</div>
          </div>
          <span class="bwb-story-source-bloc ${bloc}">${bloc.replace("-", " ")}</span>
        </header>
        <h4 class="bwb-story-source-headline">${escapeHtml(headline || s.name + " reporting")}</h4>
        ${s.excerpt ? `<p class="bwb-story-source-excerpt">${escapeHtml(s.excerpt)}</p>` : ""}
        <footer class="bwb-story-source-foot">
          <span class="bwb-story-source-factuality ${fact}">${escapeHtml(factualityLabel(s.factuality))}</span>
          ${s.bias ? `<span class="bwb-story-source-bias">${escapeHtml(s.bias)}</span>` : ""}
          ${s.tone ? `<span class="bwb-story-source-tone">${escapeHtml(s.tone)}</span>` : ""}
          ${s.paywall ? `<span class="bwb-story-source-paywall">${escapeHtml(s.paywall)}</span>` : ""}
          <a class="bwb-story-source-link" href="${escapeHtml(s.url)}" target="_blank" rel="noopener">read &nearr;</a>
        </footer>
      </article>`;
    };

    const renderColumn = (label, bloc, items) => {
      const cards = items.map((s) => renderSourceCard(s)).join("");
      return `
      <section class="bwb-story-col ${bloc}">
        <header class="bwb-story-col-head">
          <span class="bwb-story-col-bloc ${bloc}"></span>
          <h3 class="bwb-story-col-title">${escapeHtml(label)}</h3>
          <span class="bwb-story-col-count">${items.length} ${items.length === 1 ? "source" : "sources"}</span>
        </header>
        ${items.length ? cards : `<p class="bwb-story-col-empty">No ${label.toLowerCase()} coverage detected.</p>`}
      </section>`;
    };

    // Factuality ribbon — top bar showing the distribution
    const factRibbon = ["very-high", "high", "mixed", "low", "very-low", "unknown"]
      .map((k) => {
        const pct = (factTally[k] / total) * 100;
        if (!pct) return "";
        return `<div class="bwb-factuality-seg ${k}" style="width:${pct.toFixed(1)}%" title="${factualityLabel(k)}: ${Math.round(pct)}%">${pct > 8 ? Math.round(pct) + "%" : ""}</div>`;
      })
      .join("");

    const biasBar = ["western", "non-aligned", "adversarial", "other"]
      .map((k) => {
        const pct = (counts[k] / total) * 100;
        if (!pct) return "";
        return `<div class="bwb-blocs-seg ${k}" style="width:${pct.toFixed(1)}%" data-label="${k.replace("-", " ")} ${Math.round(pct)}%"></div>`;
      })
      .join("");

    const title = (story.top_headlines && story.top_headlines[0]) || "Untitled story";
    const totalSources = story.source_count || total;
    const totalCountries = (story.countries || []).length;

    mount.innerHTML = `
      <article class="bwb-story-detail">
        <nav class="bwb-story-back"><a href="${BASE}/">&larr; back to feed</a></nav>
        <header class="bwb-story-detail-head">
          <span class="bwb-story-detail-kicker">SOURCE COMPARISON</span>
          <h1 class="bwb-story-detail-title">${escapeHtml(title)}</h1>
          <div class="bwb-story-detail-meta">
            <span><strong>${totalSources}</strong> sources</span>
            <span><strong>${totalCountries}</strong> countries</span>
            <span><strong>${total}</strong> in this story</span>
            <span class="bwb-story-detail-time">${escapeHtml(timeAgo(story.lastUpdated))}</span>
          </div>
          <div class="bwb-story-signals">
            ${signals.map((s) => `<span class="bwb-signal-badge ${s.cls}">${escapeHtml(s.label)}</span>`).join("")}
          </div>
        </header>

        <section class="bwb-story-ribbon" aria-label="Source bloc distribution">
          <h2 class="bwb-story-section-kicker">BIAS SPLIT</h2>
          <div class="bwb-blocs-bar">${biasBar}</div>
        </section>

        <section class="bwb-story-ribbon" aria-label="Factuality distribution">
          <h2 class="bwb-story-section-kicker">FACTUALITY</h2>
          <div class="bwb-factuality-bar">${factRibbon}</div>
        </section>

        <section class="bwb-story-comparison">
          ${renderColumn("Western coverage", "western", byBloc.western)}
          ${renderColumn("Non-aligned coverage", "non-aligned", byBloc["non-aligned"])}
          ${renderColumn("Adversarial coverage", "adversarial", byBloc.adversarial)}
        </section>

        ${byBloc.other.length ? `<section class="bwb-story-comparison-extra">
          <h2 class="bwb-story-section-kicker">OTHER COVERAGE</h2>
          <div class="bwb-story-extra-grid">
            ${byBloc.other.map((s) => renderSourceCard(s)).join("")}
          </div>
        </section>` : ""}

        <footer class="bwb-story-detail-foot">
          <p class="bwb-story-method-note">Coverage distribution is derived from the source registry. Each source's <em>bloc</em> is the editorial orientation, <em>factuality</em> is the verification-tier rating from the asset registry, and <em>bias</em> is the lean tag from primary-source verification. Compare all ${totalSources} sources side by side to see how the same event is framed across editorial systems.</p>
        </footer>
      </article>`;
  }

  if (!id) {
    mount.innerHTML =
      '<div class="bwb-empty"><h2>No story selected</h2><p>Use ?id=STORY_ID or return to the <a href="' +
      BASE +
      '/">homepage</a>.</p></div>';
    return;
  }

  // Load both the story and the source registry in parallel
  Promise.all([
    fetch(url("/api/stories_clustered.json")).then((r) => (r.ok ? r.json() : null)),
    fetch(url("/api/sources_real_seed.json")).then((r) => (r.ok ? r.json() : null)),
  ])
    .then(([storyData, registryData]) => {
      registryByDomain = buildRegistry(registryData?.sources || []);
      const story = (storyData?.stories || []).find((s) => s.id === id);
      if (!story) {
        mount.innerHTML =
          '<div class="bwb-empty"><h2>Story not found</h2><p>This story may have expired or the ID is invalid. <a href="' +
          BASE +
          '/">Return home</a>.</p></div>';
        return;
      }
      renderStory(story);
      document.title = "Source comparison: " + ((story.top_headlines && story.top_headlines[0]) || "story") + " — BotwaveBomba";
    })
    .catch((err) => {
      console.error("[story.js] load failed", err);
      mount.innerHTML =
        '<div class="bwb-empty"><h2>Failed to load story</h2><p>Offline or data unavailable. <a href="' +
        BASE +
        '/offline.html">Offline page</a>.</p></div>';
    });
})();
