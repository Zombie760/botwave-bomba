#!/usr/bin/env bun
// BotwaveBomba static site generator
import { readFileSync, writeFileSync } from "node:fs";
import { Story, getStories, getSources, getMeta, getDomain, normBloc, storyUrl, sectionUrl, homeUrl } from "./lib/data.ts";
import { SECTIONS, classifyStory, getTrending, getStoriesBySection } from "./lib/classify.ts";
import { storyToCard, sortStoriesByCoverageGap } from "./lib/story_card.ts";

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


  // Story detail page — static shell with client hydration
  const storyDetailBody = `<div class="bwb-layout" style="grid-template-columns:1fr;">
    <div class="bwb-main" id="story-detail-mount">
      <div class="bwb-empty">
        <h2>Loading story…</h2>
        <p>One moment while we fetch the source comparison.</p>
      </div>
    </div>
  </div>
  <script src="${asset("/assets/js/story.js")}?v=1" defer></script>`;
  const storyLd = { "@context": "https://schema.org", "@type": "WebPage", "name": "Story — BotwaveBomba", "url": `${DOMAIN}${BASE}/story.html` };
  write("story.html", chrome("home", storyDetailBody, {
    title: "Story — BotwaveBomba",
    description: "Compare how sources across the Western, Non-Aligned, and Adversarial blocs cover this story.",
    canonical: `${DOMAIN}${BASE}/story.html`,
    jsonLd: storyLd
  }));

  publicPages.push({ page: "story", title: "Story — BotwaveBomba", desc: "Compare source coverage." });

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
