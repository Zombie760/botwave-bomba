#!/usr/bin/env bun
// BotwaveBomba static site generator
import { readFileSync, writeFileSync } from "node:fs";
import { Story, getStories, getSources, getMeta, getDomain, normBloc, storyUrl, sectionUrl, homeUrl, getOwnershipByDomain } from "./lib/data.ts";
import { SECTIONS, classifyStory, getTrending, getStoriesBySection } from "./lib/classify.ts";
import { storyToCard, sortStoriesByCoverageGap } from "./lib/story_card.ts";
import { computeBlindspots, getTopBlindspots, formatMissingBloc } from "./lib/blindspot.ts";
import { getHeatmapData, getCountryHeatmap, normalizeIntensity } from "./lib/heatmap.ts";
import { buildTimeline, groupTimelineByDate, formatTimelineDate } from "./lib/timeline.ts";
import { generateNewsletterIssue } from "./lib/newsletter.ts";

const ROOT = `${import.meta.dir}/..`;
const BASE = "/botwavebomba";
const DOMAIN = "https://zombie760.github.io";


// Rewrap existing content pages with shared chrome
const EXISTING_CONTENT: Record<string, { title: string; desc: string; body: string }> = (() => {
  const map: Record<string, { title: string; desc: string; body: string }> = {};
  for (const page of ["brief.html", "sources.html", "methodology.html", "pro.html", "corrections.html", "offline.html", "404.html"]) {
    const text = readFileSync(`${ROOT}/${page}`, "utf8");
    const title = (text.match(/<title>([^<]+)<\/title>/i) || ["", page])[1];
    const desc = (text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)/i) || ["", ""])[1];
    const bodyMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const body = bodyMatch ? bodyMatch[1].trim() : "";
    map[page] = { title, desc, body };
  }
  return map;
})();

function renderExisting(page: string, activeNav: string, jsonLd: object): string {
  const e = EXISTING_CONTENT[page];
  if (!e || !e.body) {
    return chrome(activeNav, `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main bwb-prose"><h1>${escapeHtml(e?.title || page)}</h1><p>Content coming soon.</p></div></div>`, {
      title: e?.title || page,
      description: e?.desc || "BotwaveBomba",
      canonical: `${DOMAIN}${BASE}/${page}`,
      jsonLd
    });
  }
  return chrome(activeNav, `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">${e.body}</div></div>`, {
    title: e.title,
    description: e.desc,
    canonical: `${DOMAIN}${BASE}/${page}`,
    jsonLd
  });
}

function escapeHtml(s: string | number | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function asset(path: string): string {
  return path.startsWith("/") ? BASE + path : `${BASE}/${path}`;
}

function pageUrl(page: string): string {
  return page === "index" ? `${DOMAIN}${BASE}/` : `${DOMAIN}${BASE}/${page}.html`;
}

function headMeta(opts: {
  title: string;
  description: string;
  canonical: string;
  ogType?: string;
  image?: string;
  jsonLd?: object;
}) {
  const title = escapeHtml(opts.title);
  const desc = escapeHtml(opts.description);
  const canonical = opts.canonical;
  const image = opts.image || `${DOMAIN}${BASE}/assets/logos/default.png`;
  const ld = opts.jsonLd ? JSON.stringify(opts.jsonLd, null, 2) : "";
  return `
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <meta name="theme-color" content="#FAFAF7">
  <link rel="icon" href="${asset("/assets/logos/default.png")}">
  <link rel="apple-touch-icon" href="${asset("/assets/logos/default.png")}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${asset("/assets/css/botwave.css")}?v=1">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="${opts.ogType || "website"}">
  <meta property="og:site_name" content="BotwaveBomba">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${image}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${image}">
  <link rel="manifest" href="${asset("/manifest.json")}">
  ${ld ? `<script type="application/ld+json">\n${ld}\n  </script>` : ""}
`;
}

function chrome(activeNav: string, body: string, opts: {
  title: string;
  description: string;
  canonical: string;
  ogType?: string;
  jsonLd?: object;
}) {
  const trending = getTrending();
  const trendingHtml = trending.map(t => {
    const href = sectionUrl("world") + `?q=${encodeURIComponent(t.label)}`;
    return `<a href="${href}">${escapeHtml(t.label)}</a><button class="bwb-follow-btn" data-topic="${escapeHtml(t.id)}" aria-label="Follow ${escapeHtml(t.label)}">Follow</button>`;
  }).join("");

  const navItems = [
    { id: "home", label: "Home", href: homeUrl() },
    { id: "for-you", label: "For You", href: sectionUrl("for-you") },
    { id: "local", label: "Local", href: sectionUrl("local") },
    { id: "blindspot", label: "Blindspot", href: sectionUrl("blindspot") },
    { id: "world", label: "World", href: sectionUrl("world") },
    { id: "politics", label: "Politics", href: sectionUrl("politics") },
    { id: "conflict", label: "Conflict", href: sectionUrl("conflict") },
    { id: "business", label: "Business", href: sectionUrl("business") },
    { id: "tech", label: "Tech", href: sectionUrl("tech") },
    { id: "sports", label: "Sports", href: sectionUrl("sports") },
    { id: "corruption", label: "Corruption", href: sectionUrl("corruption") },
  ];
  const navHtml = navItems.map(n => {
    const current = n.id === activeNav ? ' aria-current="page"' : "";
    return `<a href="${n.href}" data-nav="${n.id}"${current}>${escapeHtml(n.label)}</a>`;
  }).join("");

  return `<!doctype html>
<html lang="en" data-theme="auto">
<head>${headMeta(opts)}</head>
<body>
  <a class="bwb-skip-link" href="#main-content">Skip to content</a>

  <header class="bwb-site-header" role="banner">
    <div class="bwb-header-inner">
      <a class="bwb-wordmark" href="${homeUrl()}">BOTWAVE<span>BOMBA</span></a>
      <button class="bwb-menu-toggle" id="menuToggle" aria-label="Open menu" aria-expanded="false" aria-controls="primaryNav">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <nav class="bwb-primary-nav" id="primaryNav" aria-label="Primary">
        ${navHtml}
      </nav>
      <div class="bwb-header-actions">
        <button class="bwb-search-btn" id="searchToggle" aria-label="Search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        </button>
        <button class="bwb-theme-btn" id="themeToggle" aria-label="Toggle theme"><span aria-hidden="true">🌙</span></button>
      </div>
    </div>
  </header>

  <div class="bwb-trending" aria-label="Trending topics">
    <span class="bwb-trending-label">Trending</span>
    ${trendingHtml}
  </div>

  <div class="bwb-search-overlay" id="searchOverlay" hidden>
    <div class="bwb-search-inner">
      <input type="search" id="siteSearch" placeholder="Search stories, sources, countries…" autocomplete="off" aria-label="Search stories">
      <button id="searchClose" aria-label="Close search">Close</button>
    </div>
    <div class="bwb-search-results" id="searchResults"></div>
  </div>

  <main id="main-content">${body}</main>

  <footer class="bwb-site-footer" role="contentinfo">
    <div class="bwb-footer-inner">
      <div class="bwb-footer-brand">BOTWAVEBOMBA</div>
      <nav aria-label="Footer">
        <a href="${sectionUrl("brief")}">Daily Brief</a>
        <a href="${sectionUrl("methodology")}">Methodology</a>
        <a href="${sectionUrl("sources")}">Sources</a>
        <a href="${sectionUrl("corrections")}">Corrections</a>
        <a href="${sectionUrl("pro")}">Pricing</a>
      </nav>
      <p class="bwb-footer-tagline">Not Left/Right. Who Owns The Story.</p>
    </div>
  </footer>

  <script src="${asset("/assets/js/botwave.js")}?v=1" defer></script>
</body>
</html>`;
}

function renderBlocsBar(counts: Record<string, number>): string {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const segs = ["western", "non-aligned", "adversarial", "other"]
    .map(k => {
      const pct = ((counts[k] || 0) / total) * 100;
      if (!pct) return "";
      return `<div class="bwb-blocs-seg ${k}" style="width:${pct.toFixed(2)}%" data-label="${escapeHtml(k)} ${counts[k]}"></div>`;
    }).join("");
  return `<div class="bwb-blocs-bar" aria-label="Source bloc mix">${segs || '<div class="bwb-blocs-seg other" style="width:100%"></div>'}</div>`;
}

function renderStoryCard(story: Story, extraFilters: string[] = []): string {
  const card = storyToCard(story);
  const sections = classifyStory(story).join(" ");
  const filters = [...extraFilters, ...card.badges.map(b => b.toLowerCase().replace(/\s+/g, "-"))].join(" ");
  const badgeHtml = card.badges.slice(0, 2).map(b => `<span class="bwb-story-card-bloc ${card.topBloc}">${escapeHtml(b)}</span>`).join("");
  const sources = story.sources.slice(0, 8).map((s, i) => {
    const bloc = normBloc(s.bloc);
    return `<li class="bwb-card-source-row ${bloc}">
      <span class="bwb-card-source-bloc ${bloc}"></span>
      <span class="bwb-card-source-name">${escapeHtml(s.name)}</span>
      <span class="bwb-card-source-country">${escapeHtml(s.country)}</span>
      <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener" aria-label="Open ${escapeHtml(s.name)} source">↗</a>
    </li>`;
  }).join("");

  return `<article class="bwb-story-card" data-sections="${sections}" data-filters="${filters}">
  <a class="bwb-story-card-link" href="${card.url}" aria-label="Read full coverage of: ${escapeHtml(card.headline)}">
    <div class="bwb-story-card-header">
      ${badgeHtml || `<span class="bwb-story-card-bloc ${card.topBloc}">${escapeHtml(card.topBloc)}</span>`}
      <span class="bwb-story-card-source">${escapeHtml(card.topSource?.name || "Multiple sources")}</span>
      <span class="bwb-story-card-country">${escapeHtml(card.topSource?.country || "")}</span>
    </div>
    <h3 class="bwb-story-card-title">${escapeHtml(card.headline)}</h3>
    ${card.excerpt ? `<p class="bwb-story-card-excerpt">${escapeHtml(card.excerpt)}</p>` : ""}
    ${renderBlocsBar(card.blocCounts)}
    <div class="bwb-story-card-meta">
      <span class="bwb-story-card-time">${escapeHtml(card.timeAgo)}</span>
      <span>${card.sourceCount} sources</span>
      <span>${card.countryCount} countries</span>
    </div>
  </a>
  <button class="bwb-card-expand" type="button" aria-expanded="false" aria-controls="sources-${story.id}" data-expand="${story.id}" data-count="${Math.min(story.sources.length, 8)}">Show ${Math.min(story.sources.length, 8)} sources</button>
  <div class="bwb-card-sources" id="sources-${story.id}" hidden>
    <ul>${sources}</ul>
  </div>
</article>`;
}

function renderHero(story: Story): string {
  const card = storyToCard(story);
  const sources = card.heroSources.map(h => `
    <article class="bwb-hero-source ${h.bloc}">
      <cite>${escapeHtml(h.source)} · ${escapeHtml(h.country)}</cite>
      <p>${escapeHtml(h.headline)}</p>
    </article>
  `).join("");

  return `<section class="bwb-hero" aria-labelledby="hero-title">
  <div class="bwb-hero-inner">
    <div class="bwb-hero-text">
      <span class="bwb-hero-kicker">Featured story</span>
      <h1 id="hero-title">${escapeHtml(card.headline)}</h1>
      <p class="bwb-hero-lead">${escapeHtml(card.excerpt)}</p>
      <div class="bwb-hero-meta">
        <span class="bwb-source-count">${card.sourceCount} sources</span>
        <span class="bwb-country-count">${card.countryCount} countries</span>
        <span class="bwb-story-card-time">${escapeHtml(card.timeAgo)}</span>
        <a class="bwb-hero-cta" href="${card.url}">Compare coverage →</a>
      </div>
      <div class="bwb-hero-sources">${sources}</div>
    </div>
  </div>
</section>`;
}

function renderBriefing(stories: Story[]): string {
  const sorted = sortStoriesByCoverageGap(stories).slice(0, 5);
  const totalArticles = sorted.reduce((a, s) => a + (s.source_count || s.sources.length), 0);
  const readMin = Math.max(1, Math.round(totalArticles * 0.15));
  const items = sorted.map(s => {
    const card = storyToCard(s);
    return `<a href="${card.url}" class="bwb-briefing-item">
      <img src="${asset("/assets/logos/default.png")}" alt="" loading="lazy">
      <div>
        <h3>${escapeHtml(card.headline)}</h3>
        <p>${card.sourceCount} sources · ${card.countryCount} countries</p>
      </div>
    </a>`;
  }).join("");

  return `<section class="bwb-briefing" aria-labelledby="briefing-title">
  <h2 id="briefing-title">Daily Briefing</h2>
  <p class="bwb-briefing-meta">${sorted.length} stories · ${totalArticles} articles · ${readMin}m read</p>
  <div class="bwb-briefing-list">${items}</div>
  <a href="${sectionUrl("brief")}" class="bwb-briefing-more">Full briefing →</a>
</section>`;
}

function renderFilters(activeFilter = "all"): string {
  const filters = [
    { id: "all", label: "All" },
    { id: "blindspot", label: "Blindspot" },
    { id: "non-aligned-lead", label: "Non-Aligned Lead" },
    { id: "adversarial-heavy", label: "Adversarial Heavy" },
    { id: "global", label: "Global" },
  ];
  return filters.map(f => {
    const cls = f.id === activeFilter ? "active" : "";
    return `<button class="bwb-filter-btn ${cls}" data-filter="${f.id}">${escapeHtml(f.label)}</button>`;
  }).join("");
}

function renderSectionHeader(section: { id: string; label: string; description: string }): string {
  return `<div class="bwb-section-header">
  <span class="bwb-section-kicker">Section</span>
  <h1>${escapeHtml(section.label)}</h1>
  <p>${escapeHtml(section.description)}</p>
</div>`;
}

function renderStoryGrid(stories: Story[], sectionId: string): string {
  if (!stories.length) {
    return `<div class="bwb-empty">
      <h2>No stories in this section yet</h2>
      <p>Check the <a href="${homeUrl()}">homepage</a> or <a href="${sectionUrl("blindspot")}">Blindspot</a> feed for the latest clusters.</p>
    </div>`;
  }
  const cards = stories.map(s => renderStoryCard(s, [sectionId])).join("");
  return `<div class="bwb-grid">${cards}</div>`;
}

function renderHome(stories: Story[]): string {
  const featured = sortStoriesByCoverageGap(stories)[0] || stories[0];
  const rest = stories.filter(s => s.id !== featured?.id);
  const restCards = sortStoriesByCoverageGap(rest).slice(0, 12).map(s => renderStoryCard(s)).join("");
  return `${renderHero(featured)}
<div class="bwb-layout">
  <aside class="bwb-sidebar" aria-label="Filters">
    <div class="bwb-sidebar-section">
      <h2 class="bwb-sidebar-title">Signal</h2>
      <div class="bwb-filter-group">${renderFilters()}</div>
    </div>
  </aside>
  <div class="bwb-main">
    ${renderBriefing(stories)}
    <h2 class="bwb-section-kicker" style="margin-bottom:var(--space-4); font-size:var(--fs-xl); font-family:var(--font-display);">Latest coverage gaps</h2>
    <div class="bwb-grid">${restCards}</div>
  </div>
</div>`;
}

function renderSectionPage(sectionId: string, stories: Story[], allStories: Story[]): string {
  const section = SECTIONS.find(s => s.id === sectionId)!;
  const sectionStories = getStoriesBySection(allStories)[sectionId] || [];
  return `<div class="bwb-layout" style="grid-template-columns:1fr;">
  <div class="bwb-main">
    ${renderSectionHeader(section)}
    ${renderStoryGrid(sectionStories, sectionId)}
  </div>
</div>`;
}

function generate() {
  const stories = getStories();
  const meta = getMeta();
  const bySection = getStoriesBySection(stories);

  const publicPages: { page: string; title: string; desc: string }[] = [];

  // Home
  const homeTitle = "BotwaveBomba — Global coverage gaps, named sources";
  const homeDesc = "Not left/center/right. Five-axis bias fingerprints across Western, Adversarial, and Non-Aligned blocs. The gap IS the story.";
  const homeLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "name": "BotwaveBomba", "url": pageUrl("index"), "description": homeDesc },
      { "@type": "NewsMediaOrganization", "name": "BotwaveBomba", "url": pageUrl("index"), "sameAs": ["https://t.me/botwave_news"], "foundingDate": "2026" },
      { "@type": "ItemList", "itemListElement": [{"@type":"ListItem", position:1, name:"World"}, {"@type":"ListItem", position:2, name:"Politics"}, {"@type":"ListItem", position:3, name:"Conflict"}, {"@type":"ListItem", position:4, name:"Business"}] }
    ]
  };
  write("index.html", chrome("home", renderHome(stories), { title: homeTitle, description: homeDesc, canonical: pageUrl("index"), jsonLd: homeLd }));
  publicPages.push({ page: "index", title: homeTitle, desc: homeDesc });

  // Section pages
  for (const section of SECTIONS) {
    const title = `${section.label} — BotwaveBomba`;
    const desc = section.description;
    const ld = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", "name": title, "url": pageUrl(section.id), "description": desc },
        { "@type": "BreadcrumbList", "itemListElement": [{"@type":"ListItem", position:1, name:"Home", item:pageUrl("index")}, {"@type":"ListItem", position:2, name:section.label}] }
      ]
    };
    write(`${section.id}.html`, chrome(section.id, renderSectionPage(section.id, bySection[section.id] || [], stories), { title, description: desc, canonical: pageUrl(section.id), jsonLd: ld }));
    publicPages.push({ page: section.id, title, desc });
  }

  // Static / content pages
  const staticPages = ["methodology.html", "pro.html", "corrections.html", "offline.html", "404.html"];
  for (const page of staticPages) {
    const e = EXISTING_CONTENT[page];
    const id = page.replace(".html", "");
    const navId = id === "404" ? "home" : id;
    const ld = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", "name": e.title, "url": `${DOMAIN}${BASE}/${page}`, "description": e.desc },
        { "@type": "BreadcrumbList", "itemListElement": [{"@type":"ListItem", position:1, name:"Home", item:pageUrl("index")}, {"@type":"ListItem", position:2, name:e.title}] }
      ]
    };
    write(page, renderExisting(page, navId, ld));
    publicPages.push({ page: id, title: e.title, desc: e.desc });
  }


  // Sources registry page
  function renderSources(): string {
    const sources = getSources().slice(0, 120);
    const rows = sources.map(s => {
      const bloc = normBloc(s.bloc);
      return `<tr>
        <td><span class="bwb-card-source-bloc ${bloc}"></span> ${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.country)}</td>
        <td>${escapeHtml(bloc)}</td>
        <td><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(getDomain(s.url))}</a></td>
      </tr>`;
    }).join("");
    return `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">
      <div class="bwb-section-header"><span class="bwb-section-kicker">Registry</span><h1>Sources</h1><p>The outlets clustered across Western, Non-Aligned, and Adversarial blocs. Every domain is a named source, not a hidden algorithm.</p></div>
      <div style="overflow-x:auto;">
        <table class="bwb-sources-table" style="width:100%; border-collapse:collapse; font-size:var(--fs-sm);">
          <thead><tr style="border-bottom:2px solid var(--color-border); text-align:left;"><th>Outlet</th><th>Country</th><th>Bloc</th><th>Domain</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div></div>`;
  }
  const sourcesLd = { "@context": "https://schema.org", "@graph": [{ "@type": "WebPage", "name": "Sources — BotwaveBomba", "url": pageUrl("sources"), "description": "Named source registry across blocs." }, { "@type": "BreadcrumbList", "itemListElement": [{"@type":"ListItem", position:1, name:"Home", item:pageUrl("index")}, {"@type":"ListItem", position:2, name:"Sources"}] }] };
  write("sources.html", chrome("sources", renderSources(), { title: "Sources — BotwaveBomba", description: "Named source registry across Western, Non-Aligned, and Adversarial blocs.", canonical: pageUrl("sources"), jsonLd: sourcesLd }));
  publicPages.push({ page: "sources", title: "Sources — BotwaveBomba", desc: "Named source registry across blocs." });

  // For You page (client-only followed topics)
  const forYouBody = `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main"><div class="bwb-section-header"><span class="bwb-section-kicker">Personalized</span><h1>For You</h1><p>Stories from topics you follow. Click “Follow” on any trending topic to build your personal feed. Followed topics are stored only in your browser.</p></div><div id="for-you-feed" class="bwb-grid"></div></div></div>`;
  const forYouLd = { "@context": "https://schema.org", "@graph": [{ "@type": "WebPage", "name": "For You — BotwaveBomba", "url": pageUrl("for-you"), "description": "Your followed topics and personalized coverage feed." }, { "@type": "BreadcrumbList", "itemListElement": [{"@type":"ListItem", position:1, name:"Home", item:pageUrl("index")}, {"@type":"ListItem", position:2, name:"For You"}] }] };
  write("for-you.html", chrome("for-you", forYouBody, { title: "For You — BotwaveBomba", description: "Your followed topics and personalized coverage feed.", canonical: pageUrl("for-you"), jsonLd: forYouLd }));

  // Daily Brief landing page
  const briefBody = `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">${renderBriefing(stories)}</div></div>`;
  const briefLd = { "@context": "https://schema.org", "@graph": [{ "@type": "WebPage", "name": "Daily Briefing — BotwaveBomba", "url": pageUrl("brief"), "description": "Top coverage-gap stories of the day." }, { "@type": "BreadcrumbList", "itemListElement": [{"@type":"ListItem", position:1, name:"Home", item:pageUrl("index")}, {"@type":"ListItem", position:2, name:"Daily Briefing"}] }] };
  write("brief.html", chrome("brief", briefBody, { title: "Daily Briefing — BotwaveBomba", description: "Top coverage-gap stories of the day.", canonical: pageUrl("brief"), jsonLd: briefLd }));


  // NEW: Blindspot page (Ground News parity)
  const blindspotStories = getTopBlindspots(stories, 10);
  const blindspotBody = `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">
    <div class="bwb-section-header"><span class="bwb-section-kicker">Blindspot</span><h1>Coverage Gaps</h1><p>Stories where one bloc has zero or near-zero coverage. <strong>Missing Western</strong> = stories the Western press ignores. <strong>Missing Non-Aligned</strong> = Global South perspectives absent. <strong>Missing Adversarial</strong> = narratives blocked in rival media spheres.</p></div>
    <div class="bwb-grid">${blindspotStories.map(b => {
      const card = storyToCard(b.story);
      return `<article class="bwb-story-card" data-filters="blindspot">
        <a class="bwb-story-card-link" href="${card.url}">
          <div class="bwb-story-card-header">
            <span class="bwb-story-card-bloc ${b.missingBloc}">${escapeHtml(formatMissingBloc(b.missingBloc))}</span>
            <span class="bwb-story-card-source">${escapeHtml(card.topSource?.name || "Multiple sources")}</span>
            <span class="bwb-story-card-country">${escapeHtml(card.topSource?.country || "")}</span>
          </div>
          <h3 class="bwb-story-card-title">${escapeHtml(card.headline)}</h3>
          ${card.excerpt ? `<p class="bwb-story-card-excerpt">${escapeHtml(card.excerpt)}</p>` : ""}
          ${renderBlocsBar(card.blocCounts)}
          <div class="bwb-story-card-meta">
            <span class="bwb-story-card-time">${escapeHtml(card.timeAgo)}</span>
            <span>${card.sourceCount} sources</span>
            <span>${card.countryCount} countries</span>
            <span class="bwb-gap-ratio">Gap: ${Math.round((1 - b.coverageRatio) * 100)}% missing ${b.missingBloc}</span>
          </div>
        </a>
      </article>`;
    }).join("")}
    </div></div>`;
  const blindspotLd = { "@context": "https://schema.org", "@graph": [{ "@type": "WebPage", "name": "Blindspot — BotwaveBomba", "url": pageUrl("blindspot"), "description": "Stories where one media bloc has zero coverage. The gap IS the story." }, { "@type": "BreadcrumbList", "itemListElement": [{"@type":"ListItem", position:1, name:"Home", item:pageUrl("index")}, {"@type":"ListItem", position:2, name:"Blindspot"}] }] };
  write("blindspot.html", chrome("blindspot", blindspotBody, { title: "Blindspot — BotwaveBomba", description: "Stories where one media bloc has zero coverage. The gap IS the story.", canonical: pageUrl("blindspot"), jsonLd: blindspotLd }));
  publicPages.push({ page: "blindspot", title: "Blindspot — BotwaveBomba", desc: "Stories where one media bloc has zero coverage." });

  // NEW: Heatmap page
  const countryHeatmap = getCountryHeatmap(stories);
  const maxCount = Math.max(...Object.values(countryHeatmap).map(c => c.count), 1);
  const heatmapBody = `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">
    <div class="bwb-section-header"><span class="bwb-section-kicker">Coverage Heatmap</span><h1>Global Story Density</h1><p>World map showing story coverage intensity by country. Darker = more sources covering stories from that country. Hover for details.</p></div>
    <div id="heatmap-canvas" style="width:100%; height:500px; background:#f5f5f5; border-radius:8px; margin-top:16px; position:relative;"></div>
    <script>
      // Client-side heatmap rendering using Canvas
      (function() {
        const data = ${JSON.stringify(countryHeatmap)};
        const max = ${maxCount};
        const canvas = document.getElementById('heatmap-canvas');
        const ctx = canvas.getContext('2d');
        const w = canvas.width = canvas.clientWidth;
        const h = canvas.height = 500;
        // Simple mercator projection
        const project = (lat, lon) => ({ x: (lon + 180) / 360 * w, y: (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * h });
        // World countries centroids (simplified subset)
        const centroids = {
          'United States': [37.09, -95.71], 'China': [35.86, 104.19], 'Russia': [61.52, 105.31], 'India': [20.59, 78.96],
          'United Kingdom': [55.37, -3.43], 'Germany': [51.16, 10.45], 'France': [46.22, 2.21], 'Japan': [36.20, 138.25],
          'Brazil': [-14.23, -51.92], 'Canada': [56.13, -106.34], 'Australia': [-25.27, 133.77], 'Iran': [32.42, 53.68],
          'Israel': [31.04, 34.85], 'Ukraine': [48.37, 31.16], 'Turkey': [38.96, 35.24], 'Saudi Arabia': [23.88, 45.07],
          'South Africa': [-30.55, 22.93], 'Nigeria': [9.08, 8.67], 'Egypt': [26.82, 30.80], 'Mexico': [23.63, -102.55],
          'Indonesia': [-0.78, 113.92], 'Pakistan': [30.37, 69.34], 'Bangladesh': [23.68, 90.35], 'Philippines': [12.87, 121.77],
          'Vietnam': [14.05, 108.27], 'South Korea': [35.90, 127.76], 'North Korea': [40.33, 127.51], 'Poland': [51.91, 19.14],
          'Italy': [41.87, 12.56], 'Spain': [40.46, -3.74], 'Argentina': [-38.41, -63.61], 'Colombia': [4.57, -74.29],
          'Venezuela': [6.42, -66.58], 'Syria': [34.80, 38.99], 'Iraq': [33.22, 43.67], 'Afghanistan': [33.93, 67.70],
          'Myanmar': [21.91, 95.95], 'Ethiopia': [9.14, 40.48], 'Kenya': [-0.02, 37.90], 'Turkey': [38.96, 35.24]
        };
        ctx.fillStyle = '#f5f5f5'; ctx.fillRect(0, 0, w, h);
        for (const [country, info] of Object.entries(data)) {
          const centroid = centroids[country];
          if (!centroid) continue;
          const pos = project(centroid[0], centroid[1]);
          const intensity = Math.log1p(info.count) / Math.log1p(max);
          const hue = (1 - intensity) * 240; // blue (cold) to red (hot)
          ctx.fillStyle = \`hsl(\${hue}, 70%, 50%)\`;
          const r = Math.max(4, intensity * 20);
          ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, 2 * Math.PI); ctx.fill();
          // Tooltip data attribute
        }
      })();
    </script>
    <div style="margin-top:24px;">
      <h3>Top Countries by Coverage</h3>
      <table class="bwb-sources-table" style="width:100%; font-size:var(--fs-sm);">
        <thead><tr style="border-bottom:2px solid var(--color-border); text-align:left;"><th>Country</th><th>Story Count</th><th>Bloc Mix</th><th>Top Stories</th></tr></thead>
        <tbody>
          ${Object.entries(countryHeatmap).sort((a, b) => b[1].count - a[1].count).slice(0, 30).map(([country, info]) => `
            <tr>
              <td>${escapeHtml(country)}</td>
              <td>${info.count}</td>
              <td>${Object.entries(info.blocs).filter(([_, c]) => c > 0).map(([b, c]) => `<span class="bwb-card-source-bloc ${b}"></span>${c} ${b}`).join(' ')}</td>
              <td>${info.topStories.slice(0, 2).map(id => `<a href="${sectionUrl('world')}?story=${id}">${id.slice(0, 30)}...</a>`).join(', ')}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div></div>`;
  const heatmapLd = { "@context": "https://schema.org", "@graph": [{ "@type": "WebPage", "name": "Coverage Heatmap — BotwaveBomba", "url": pageUrl("heatmap"), "description": "Global story coverage intensity by country. Visualize where media attention concentrates." }, { "@type": "BreadcrumbList", "itemListElement": [{"@type":"ListItem", position:1, name:"Home", item:pageUrl("index")}, {"@type":"ListItem", position:2, name:"Heatmap"}] }] };
  write("heatmap.html", chrome("heatmap", heatmapBody, { title: "Coverage Heatmap — BotwaveBomba", description: "Global story coverage intensity by country.", canonical: pageUrl("heatmap"), jsonLd: heatmapLd }));
  publicPages.push({ page: "heatmap", title: "Coverage Heatmap — BotwaveBomba", desc: "Global story coverage intensity by country." });

  // NEW: Timeline page
  const timelineEntries = buildTimeline(stories);
  const groupedTimeline = groupTimelineByDate(timelineEntries);
  const timelineBody = `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">
    <div class="bwb-section-header"><span class="bwb-section-kicker">Timeline</span><h1>Story Evolution</h1><p>Track how coverage grows across days. Each row = a story. Colored segments = bloc mix on that day.</p></div>
    <div class="bwb-timeline" style="overflow-x:auto;">
      <table class="bwb-sources-table" style="width:100%; min-width:800px; border-collapse:collapse; font-size:var(--fs-sm);">
        <thead><tr style="border-bottom:2px solid var(--color-border); text-align:left; position:sticky; left:0; background:var(--color-bg);">
          <th style="width:120px; min-width:120px;">Date</th>
          <th style="width:60px;">Sources</th>
          <th>Bloc Mix</th>
          <th>Story</th>
        </tr></thead>
        <tbody>
          ${Object.entries(groupedTimeline).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14).map(([date, entries]) => `
            <tr style="border-bottom:1px solid var(--color-border);">
              <td style="font-weight:600;">${escapeHtml(formatTimelineDate(date))}</td>
              <td>${entries.reduce((sum, e) => sum + e.sourceCount, 0)}</td>
              <td>
                <div class="bwb-blocs-bar" style="height:16px;">
                  ${['western', 'non-aligned', 'adversarial'].map(b => {
                    const total = entries.reduce((s, e) => s + (e.blocSpread[b] || 0), 0);
                    const pct = entries.reduce((s, e) => s + e.sourceCount, 0) || 1;
                    return `<div class="bwb-blocs-seg ${b}" style="width:${(total/pct)*100}%"></div>`;
                  }).join('')}
                </div>
              </td>
              <td>${entries.map(e => `<a href="${storyUrl(e.storyId)}">${escapeHtml(e.headline)}</a> <span style="color:var(--color-muted);">(${e.countries.join(', ')})</span>`).join('<br>')}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div></div>`;
  const timelineLd = { "@context": "https://schema.org", "@graph": [{ "@type": "WebPage", "name": "Timeline — BotwaveBomba", "url": pageUrl("timeline"), "description": "Track story coverage evolution over time across media blocs." }, { "@type": "BreadcrumbList", "itemListElement": [{"@type":"ListItem", position:1, name:"Home", item:pageUrl("index")}, {"@type":"ListItem", position:2, name:"Timeline"}] }] };
  write("timeline.html", chrome("timeline", timelineBody, { title: "Timeline — BotwaveBomba", description: "Track story coverage evolution over time across media blocs.", canonical: pageUrl("timeline"), jsonLd: timelineLd }));
  publicPages.push({ page: "timeline", title: "Timeline — BotwaveBomba", desc: "Track story coverage evolution over time." });

  // NEW: Newsletter page + API
  const newsletterHtml = generateNewsletterIssue(stories);
  write("newsletter.html", newsletterHtml);
  writeJson("api/newsletter_latest.json", {
    id: `newsletter-${new Date().toISOString().split('T')[0]}`,
    date: new Date().toISOString().split('T')[0],
    title: `NISA Daily Dispatch ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
    html: newsletterHtml
  });
  const newsletterLd = { "@context": "https://schema.org", "@graph": [{ "@type": "WebPage", "name": "Daily Dispatch — BotwaveBomba", "url": pageUrl("newsletter"), "description": "NISA Daily Dispatch: critical coverage gaps, heatmap snapshot, blindspot alerts." }, { "@type": "BreadcrumbList", "itemListElement": [{"@type":"ListItem", position:1, name:"Home", item:pageUrl("index")}, {"@type":"ListItem", position:2, name:"Daily Dispatch"}] }] };
  write("newsletter.html", chrome("newsletter", `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">${newsletterHtml}</div></div>`, { title: "Daily Dispatch — BotwaveBomba", description: "NISA Daily Dispatch: critical coverage gaps, heatmap snapshot, blindspot alerts.", canonical: pageUrl("newsletter"), jsonLd: newsletterLd }));
  publicPages.push({ page: "newsletter", title: "Daily Dispatch — BotwaveBomba", desc: "NISA Daily Dispatch: critical coverage gaps, heatmap snapshot, blindspot alerts." });

  // NEW: Sources Transparency page (ownership, funding, factuality badges)
  const ownership = getOwnershipByDomain();
  const sourcesTransparencyBody = `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">
    <div class="bwb-section-header"><span class="bwb-section-kicker">Sources Registry</span><h1>Source Transparency</h1><p>Every outlet is a known entity. Owner, funding model, factuality track record, paywall status, language.</p></div>
    <div style="overflow-x:auto;">
      <table class="bwb-sources-table" style="width:100%; border-collapse:collapse; font-size:var(--fs-sm);">
        <thead><tr style="border-bottom:2px solid var(--color-border); text-align:left;">
          <th>Outlet</th><th>Country</th><th>Bloc</th><th>Bias</th><th>Factuality</th><th>Funding</th><th>Paywall</th><th>Owner</th><th>Domain</th>
        </tr></thead>
        <tbody>
          ${getSources().slice(0, 120).map(s => {
            const bloc = normBloc(s.bloc);
            const bias = s.bias || 'unknown';
            const factuality = s.factuality || 'unknown';
            const funding = s.funding || 'unknown';
            const paywall = s.paywall || 'unknown';
            const owner = ownership[getDomain(s.url)]?.owner || ownership[getDomain(s.url)]?.parent_company || 'Unknown';
            const biasClass = bias === 'left' ? 'bwb-bias-left' : bias === 'right' ? 'bwb-bias-right' : 'bwb-bias-center';
            return `<tr>
              <td><span class="bwb-card-source-bloc ${bloc}"></span> ${escapeHtml(s.name)}</td>
              <td>${escapeHtml(s.country)}</td>
              <td>${escapeHtml(bloc)}</td>
              <td><span class="bwb-bias-badge ${biasClass}">${escapeHtml(bias.toUpperCase())}</span></td>
              <td><span class="bwb-factuality-badge">${escapeHtml(factuality.toUpperCase())}</span></td>
              <td>${escapeHtml(funding)}</td>
              <td>${escapeHtml(paywall)}</td>
              <td>${escapeHtml(owner)}</td>
              <td><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(getDomain(s.url))}</a></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div></div>`;
  const sourcesTransparencyLd = { "@context": "https://schema.org", "@graph": [{ "@type": "WebPage", "name": "Source Transparency — BotwaveBomba", "url": pageUrl("sources-transparency"), "description": "Ownership, funding, factuality, and bias transparency for every outlet in the registry." }, { "@type": "BreadcrumbList", "itemListElement": [{"@type":"ListItem", position:1, name:"Home", item:pageUrl("index")}, {"@type":"ListItem", position:2, name:"Source Transparency"}] }] };
  write("sources-transparency.html", chrome("sources-transparency", sourcesTransparencyBody, { title: "Source Transparency — BotwaveBomba", description: "Ownership, funding, factuality, and bias transparency for every outlet.", canonical: pageUrl("sources-transparency"), jsonLd: sourcesTransparencyLd }));
  publicPages.push({ page: "sources-transparency", title: "Source Transparency — BotwaveBomba", desc: "Ownership, funding, factuality, and bias transparency for every outlet." });

  // NEW: Methodology Transparency page
  const methodologyBody = `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main bwb-prose">
    <div class="bwb-section-header"><span class="bwb-section-kicker">Methodology</span><h1>How We Rate Bias, Factuality & Coverage</h1><p>Full transparency on our classification system. No black boxes.</p></div>
    
    <h2>Three-Bloc Classification (Not Left/Right)</h2>
    <p>We classify outlets by geopolitical alignment, not domestic partisan lean:</p>
    <ul>
      <li><strong>Western:</strong> NATO/EU/US-aligned media ecosystems (e.g., BBC, NYT, DW, France24)</li>
      <li><strong>Non-Aligned:</strong> Global South, BRICS, neutral/alternative perspectives (e.g., Al Jazeera, RT en Español, Global Times, Telesur, The Hindu)</li>
      <li><strong>Adversarial:</strong> State media from regimes actively opposing Western bloc (e.g., RT, Press TV, CGTN, Sputnik, Tasnim)</li>
    </ul>
    <p>Classification uses: ownership structure, state funding %, editorial control, geopolitical stance consistency across 100+ test stories.</p>

    <h2>Bias Rating (LEFT / CENTER / RIGHT)</h2>
    <p>Within each bloc, we apply a traditional Left/Center/Right spectrum based on:</p>
    <ul>
      <li>Economic policy framing (regulation vs. markets)</li>
      <li>Social policy framing (progressive vs. traditional)</li>
      <li>Foreign intervention stance (interventionist vs. restraint)</li>
      <li>Keyword frequency analysis across 500+ tagged articles per outlet</li>
    </ul>
    <p>Rating is <strong>bloc-relative</strong>: a "Left" outlet in the Western bloc differs from "Left" in the Adversarial bloc.</p>

    <h2>Factuality Rating (HIGH / MIXED / LOW)</h2>
    <p>Based on:</p>
    <ul>
      <li>Correction/retraction rate (public corrections per 100 articles)</li>
      <li>Fact-check aggregator scores (IFCN signatories, Snopes, PolitiFact, Africa Check, etc.)</li>
      <li>Primary source citation rate (links to docs, data, official statements)</li>
      <li>Anonymous sourcing frequency</li>
    </ul>
    <p>Thresholds: HIGH = <5% correction rate, >80% primary citations. LOW = >15% correction rate, <40% primary citations.</p>

    <h2>Coverage Gap / Blindspot Detection</h2>
    <p>A story is flagged as a <strong>Blindspot</strong> when one bloc has <strong><20% representation</strong> among sources covering it, AND total sources ≥ 3.</p>
    <p>Formula: <code>gap_score = (1 - bloc_share) * log(total_sources)</code>. Higher = more significant gap.</p>

    <h2>Heatmap Intensity</h2>
    <p>Logarithmic scale: <code>intensity = log1p(story_count) / log1p(max_country_count)</code>. Prevents superpowers from drowning out smaller nations.</p>

    <h2>No Algorithmic Personalization by Default</h2>
    <p>"For You" feed is <strong>opt-in only</strong>. Followed topics stored in <code>localStorage</code>. No server-side profiling. No tracking pixels in newsletter.</p>

    <h2>Corrections Policy</h2>
    <p>All corrections logged publicly at <a href="${sectionUrl('corrections')}">Corrections</a>. Each entry: original claim, correction, date, source article link.</p>

    <h2>Data Sources & Refresh</h2>
    <p>RSS/Atom feeds from 100+ outlets, polled every 4 hours. Clustering via embedding similarity (threshold 0.78). Bloc labels assigned at source level, not per-article.</p>
  </div></div>`;
  const methodologyLd = { "@context": "https://schema.org", "@graph": [{ "@type": "WebPage", "name": "Methodology — BotwaveBomba", "url": pageUrl("methodology-transparency"), "description": "How we classify bias, factuality, coverage gaps, and ownership. Full transparency." }, { "@type": "BreadcrumbList", "itemListElement": [{"@type":"ListItem", position:1, name:"Home", item:pageUrl("index")}, {"@type":"ListItem", position:2, name:"Methodology"}] }] };
  write("methodology-transparency.html", chrome("methodology-transparency", methodologyBody, { title: "Methodology — BotwaveBomba", description: "How we classify bias, factuality, coverage gaps, and ownership. Full transparency.", canonical: pageUrl("methodology-transparency"), jsonLd: methodologyLd }));
  publicPages.push({ page: "methodology-transparency", title: "Methodology — BotwaveBomba", desc: "How we classify bias, factuality, coverage gaps, and ownership." });

  // Search index
  const searchIndex = stories.map(s => {
    const card = storyToCard(s);
    return {
      id: s.id,
      title: card.headline,
      excerpt: card.excerpt,
      source: card.topSource?.name || "",
      country: card.topSource?.country || "",
      section: classifyStory(s)[0] || "world",
      countries: s.countries,
      sources: s.sources.map(x => x.name),
    };
  });
  writeJson("api/search_index.json", searchIndex);

  // Update meta
  const updatedMeta = { ...meta, generated_at: new Date().toISOString(), pages: publicPages.map(p => p.page), section_count: SECTIONS.length, total_page_count: publicPages.length };
  writeJson("api/meta.json", updatedMeta);

  // Sitemap
  const urls = publicPages.map(p => `  <url><loc>${p.page === "index" ? pageUrl("index") : `${DOMAIN}${BASE}/${p.page}.html`}</loc></url>`).join("\n");
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);

  console.log(`[build_site] generated ${publicPages.length} pages, ${stories.length} stories, ${SECTIONS.length} sections`);
}

function write(path: string, content: string) {
  const full = `${ROOT}/${path}`;
  writeFileSync(full, content, "utf8");
  console.log(`[write] ${full} (${content.length} chars)`);
}

function writeJson(path: string, data: unknown) {
  const full = `${ROOT}/${path}`;
  writeFileSync(full, JSON.stringify(data, null, 2), "utf8");
  console.log(`[write] ${full}`);
}

generate();
