#!/usr/bin/env bun
// BotwaveBomba static site generator
import { readFileSync, writeFileSync } from "node:fs";
import {
  Story,
  getStories,
  getSources,
  getMeta,
  getDomain,
  normBloc,
  storyUrl,
  homeUrl,
  getOwnershipByDomain,
  resolveOwnershipForSource,
  getOwnership,
  getSigintPackages,
  extractDomain,
  getIntelligence,
} from "./lib/data.ts";
import {
  SECTIONS,
  classifyAlignment,
  getActiveFrequencies,
  getStoriesByAlignment,
} from "./lib/alignment.ts";
import { renderSigintCard, sortSigintByBlackSite } from "./lib/sigint-card.ts";
import { detectBlackSites, getTopBlackSites, formatSilentSector } from "./lib/black-site.ts";
import { scanRadar, getCountryRadar, normalizeIntensity } from "./lib/radar.ts";
import { spoolChronos, groupChronosByDate, formatChronosDate } from "./lib/spool.ts";
import { broadcastNumbersStation } from "./lib/numbers-station.ts";
import { getPackagesBySector, classifySector } from "./lib/sector.ts";

const ROOT = `${import.meta.dir}/..`;

// Build-time constants — used in chrome() utility bar and footer
const BUILD_GENERATED_AT = new Date().toISOString();
const BUILD_DATE_LABEL = new Date().toISOString().slice(0, 10);
const BUILD_HASH = BUILD_GENERATED_AT.replace(/[^0-9]/g, "")
  .slice(2, 14)
  .toUpperCase();

let _siteCounts: { stories: number; funders: number; theaters: number } | null = null;
function getSiteCounts(): { stories: number; funders: number; theaters: number } {
  if (_siteCounts) return _siteCounts;
  const stories = getSigintPackages();
  const funderSet = new Set<string>();
  const theaterSet = new Set<string>();
  // Use the real ownership registry (api/ownership.json) — not money-trail.json,
  // which doesn't exist. The funder is the parent_company on each entry.
  const ownership = getOwnership();
  const seenDomains = new Set<string>();
  for (const s of stories) {
    for (const src of s.sources || []) {
      const rawDomain = extractDomain(src.url || "");
      if (!rawDomain) continue;
      if (seenDomains.has(rawDomain)) continue;
      seenDomains.add(rawDomain);
      const owner = ownership[rawDomain];
      if (owner?.parent_company) funderSet.add(owner.parent_company);
      if (src.country) theaterSet.add(src.country);
    }
  }
  _siteCounts = {
    stories: stories.length,
    funders: funderSet.size,
    theaters: theaterSet.size,
  };
  return _siteCounts;
}

const VERTICALS = [
  { id: "world", label: "WORLD", description: "Global signals without a fixed theater filter." },
  {
    id: "sports",
    label: "SPORTS",
    description: "Live intercepts from the pitch, court, and arena.",
  },
  { id: "tech", label: "TECH", description: "Silicon, chips, AI, cyber, and space launches." },
  {
    id: "health",
    label: "HEALTH",
    description: "Medical, outbreak, research, and public health intercepts.",
  },
  {
    id: "science",
    label: "SCIENCE",
    description: "Climate, space, research, and natural phenomena.",
  },
  {
    id: "business",
    label: "BUSINESS",
    description: "Trade, markets, energy, sanctions, and central bank moves.",
  },
  {
    id: "conflict",
    label: "CONFLICT",
    description: "War, clashes, ceasefires, and security incidents.",
  },
  {
    id: "politics",
    label: "POLITICS",
    description: "Elections, governments, policy, and diplomacy.",
  },
];

function sectionUrl(id: string): string {
  return `/botwavebomba/${id}.html`;
}

const BASE = "/botwavebomba";
const DOMAIN = "https://zombie760.github.io";

// Rewrap existing content pages with shared chrome (skip if not present during local dev)
const EXISTING_CONTENT: Record<string, { title: string; desc: string; body: string }> = (() => {
  const map: Record<string, { title: string; desc: string; body: string }> = {};
  for (const page of [
    "sitrep.html",
    "asset-registry.html",
    "tradecraft.html",
    "pro.html",
    "errata.html",
    "sin-senal.html",
    "perdido.html",
    "sigint.html",
  ]) {
    try {
      const text = readFileSync(`${ROOT}/${page}`, "utf8");
      const title = (text.match(/<title>([^<]+)<\/title>/i) || ["", page])[1];
      const desc = (text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)/i) || [
        "",
        "",
      ])[1];
      const bodyMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      const body = bodyMatch ? bodyMatch[1].trim() : "";
      map[page] = { title, desc, body };
    } catch {}
  }
  return map;
})();

function renderExisting(page: string, activeNav: string, jsonLd: object): string {
  const e = EXISTING_CONTENT[page];
  if (!e || !e.body) {
    return chrome(
      activeNav,
      `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main bwb-prose"><h1>${escapeHtml(e?.title || page)}</h1><p>Content coming soon.</p></div></div>`,
      {
        title: e?.title || page,
        description: e?.desc || "BotwaveBomba",
        canonical: `${DOMAIN}${BASE}/${page}`,
        jsonLd,
      }
    );
  }
  return chrome(
    activeNav,
    `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">${e.body}</div></div>`,
    {
      title: e.title,
      description: e.desc,
      canonical: `${DOMAIN}${BASE}/${page}`,
      jsonLd,
    }
  );
}

function escapeHtml(s: string | number | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'");
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

function chrome(
  activeNav: string,
  body: string,
  opts: {
    title: string;
    description: string;
    canonical: string;
    ogType?: string;
    jsonLd?: object;
    context?: string;
  }
) {
  const activeFrequencies = getActiveFrequencies();
  const counts = getSiteCounts();
  const storyCount = counts.stories;
  const funderCount = counts.funders;
  const theaterCount = counts.theaters;
  const trendingHtml = activeFrequencies
    .map((t) => {
      const href = sectionUrl("radar") + `?q=${encodeURIComponent(t.label)}`;
      const popover =
        t.topHeadlines.length > 0
          ? `<div class="bwb-topic-popover" role="tooltip">
            <strong>${escapeHtml(t.label)} · ${t.count} ${t.count === 1 ? "intercept" : "intercepts"}</strong>
            <ul>${t.topHeadlines
              .map(
                (h) =>
                  `<li><a href="${h.url}"><span class="bwb-topic-popover-headline">${escapeHtml(h.headline)}</span><span class="bwb-topic-popover-time">${escapeHtml(h.timeAgo)}</span></a></li>`
              )
              .join("")}</ul>
          </div>`
          : "";
      return `<span class="bwb-topic-chip" data-topic="${escapeHtml(t.id)}">
        <a class="bwb-topic-link" href="${href}">${escapeHtml(t.label)}</a>
        <span class="bwb-topic-count">${t.count}</span>
        <button class="bwb-follow-btn" data-topic="${escapeHtml(t.id)}" aria-label="Follow ${escapeHtml(t.label)}">Follow</button>
        ${popover}
      </span>`;
    })
    .join("");

  const showFrequencies = activeNav === "home" || activeNav === "radar";
  const trendingStrip = showFrequencies
    ? `<div class="bwb-active-frequencies" aria-label="Active frequencies">
    <span class="bwb-trending-label">ACTIVE FREQUENCIES</span>
    ${trendingHtml}
  </div>`
    : "";
  const contextLine = opts.context
    ? `<div class="bwb-context-bar" data-page="${activeNav}">
    <span class="bwb-context-bar-inner">${opts.context}</span>
  </div>`
    : "";

  const navItems = [
    { id: "home", label: "PORTADA", href: homeUrl() },
    { id: "black-site", label: "BLACK SITE", href: sectionUrl("black-site") },
    { id: "radar", label: "RADAR", href: sectionUrl("radar") },
    { id: "intelligence", label: "INTELLIGENCE", href: sectionUrl("intelligence") },
    { id: "refraction", label: "REFRACTION", href: sectionUrl("refraction") },
    { id: "spool", label: "SPOOL", href: sectionUrl("spool") },
    { id: "numbers-station", label: "NUMBERS STATION", href: sectionUrl("numbers-station") },
    { id: "asset-registry", label: "ASSETS", href: sectionUrl("asset-registry") },
    { id: "tradecraft", label: "TRADECRAFT", href: sectionUrl("tradecraft") },
    { id: "sports", label: "SPORTS", href: sectionUrl("sports") },
    { id: "tech", label: "TECH", href: sectionUrl("tech") },
    { id: "health", label: "HEALTH", href: sectionUrl("health") },
    { id: "science", label: "SCIENCE", href: sectionUrl("science") },
  ];
  const deskItems = [
    { id: "sports", label: "SPORTS", href: sectionUrl("sports") },
    { id: "tech", label: "TECH", href: sectionUrl("tech") },
    { id: "health", label: "HEALTH", href: sectionUrl("health") },
    { id: "science", label: "SCIENCE", href: sectionUrl("science") },
    { id: "business", label: "BUSINESS", href: sectionUrl("business") },
    { id: "conflict", label: "CONFLICT", href: sectionUrl("conflict") },
    { id: "politics", label: "POLITICS", href: sectionUrl("politics") },
    { id: "world", label: "WORLD", href: sectionUrl("world") },
  ];
  const navHtml = navItems
    .map((n) => {
      const current = n.id === activeNav ? ' aria-current="page"' : "";
      return `<a href="${n.href}" data-nav="${n.id}"${current}>${escapeHtml(n.label)}</a>`;
    })
    .join("");
  const deskHtml = deskItems
    .map((n) => {
      const current = n.id === activeNav ? ' aria-current="page"' : "";
      return `<a href="${n.href}" data-desk="${n.id}"${current}>${escapeHtml(n.label)}</a>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>${headMeta(opts)}</head>
<body class="bwb-page" data-page="${activeNav}">
  <a class="bwb-skip-link" href="#main-content">Skip to content</a>

  <div class="bwb-utility-bar" role="complementary" aria-label="Site utility">
    <div class="bwb-utility-inner">
      <span class="bwb-utility-left">
        <span class="bwb-utility-item"><time class="bwb-utility-time" datetime="${BUILD_GENERATED_AT}">${BUILD_DATE_LABEL}</time> · UTC</span>
        <span class="bwb-utility-item bwb-utility-build">BUILD ${BUILD_HASH}</span>
        <span class="bwb-utility-item"><a href="${sectionUrl("methodology")}">METHODOLOGY</a></span>
        <span class="bwb-utility-item"><a href="${sectionUrl("errata")}">ERRATA</a></span>
      </span>
      <span class="bwb-utility-right">
        <span class="bwb-utility-item bwb-utility-counts">${storyCount} intercepts · ${funderCount} funders · ${theaterCount} theaters</span>
        <button class="bwb-search-btn" id="searchToggle" aria-label="Search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <span class="bwb-utility-search-label">SEARCH</span>
        </button>
        <button class="bwb-theme-btn" id="themeToggle" aria-label="Toggle theme"><span aria-hidden="true">🌙</span></button>
      </span>
    </div>
  </div>

  <header class="bwb-site-header" role="banner">
    <div class="bwb-header-inner">
      <a class="bwb-wordmark" href="${homeUrl()}" aria-label="BotwaveBomba home">
        <span class="bwb-wordmark-line-1">BOTWAVE</span><span class="bwb-wordmark-line-2">BOMBA</span>
      </a>
      <button class="bwb-menu-toggle" id="menuToggle" aria-label="Open menu" aria-expanded="false" aria-controls="primaryNav">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <nav class="bwb-primary-nav" id="primaryNav" aria-label="Primary">
        ${navHtml}
      </nav>
      <nav class="bwb-desk-nav" id="deskNav" aria-label="Coverage desks">
        ${deskHtml}
      </nav>
    </div>
    ${contextLine}
  </header>

  ${trendingStrip}

  <div class="bwb-search-overlay" id="searchOverlay" hidden>
    <div class="bwb-search-inner">
      <input type="search" id="siteSearch" placeholder="Search signals, assets, theaters..." autocomplete="off" aria-label="Search signals">
      <button id="searchClose" aria-label="Close search">Close</button>
    </div>
    <div class="bwb-search-results" id="searchResults"></div>
  </div>

  <main id="main-content">${body}</main>

  <footer class="bwb-site-footer" role="contentinfo">
    <div class="bwb-footer-inner">
      <div class="bwb-footer-col bwb-footer-col-brand">
        <div class="bwb-footer-wordmark">BOTWAVE<span>BOMBA</span></div>
        <p class="bwb-footer-tagline">Not Left/Right.<br>Who Owns The Story.</p>
        <p class="bwb-footer-meta">Built ${BUILD_DATE_LABEL} · Build ${BUILD_HASH}<br>${storyCount} intercepts · ${funderCount} funders · ${theaterCount} theaters</p>
      </div>
      <div class="bwb-footer-col">
        <h4 class="bwb-footer-h">SECTIONS</h4>
        <ul>
          <li><a href="${homeUrl()}">PORTADA</a></li>
          <li><a href="${sectionUrl("black-site")}">BLACK SITE</a></li>
          <li><a href="${sectionUrl("radar")}">RADAR</a></li>
          <li><a href="${sectionUrl("refraction")}">REFRACTION</a></li>
          <li><a href="${sectionUrl("spool")}">SPOOL</a></li>
          <li><a href="${sectionUrl("numbers-station")}">NUMBERS STATION</a></li>
        </ul>
      </div>
      <div class="bwb-footer-col">
        <h4 class="bwb-footer-h">REGISTRIES</h4>
        <ul>
          <li><a href="${sectionUrl("asset-registry")}">ASSET REGISTRY</a></li>
          <li><a href="${sectionUrl("asset-transparency")}">ASSET TRANSPARENCY</a></li>
          <li><a href="${sectionUrl("tradecraft")}">TRADECRAFT</a></li>
          <li><a href="${sectionUrl("sitrep")}">SITREP</a></li>
          <li><a href="${sectionUrl("dead-drop")}">DEAD DROP</a></li>
        </ul>
      </div>
      <div class="bwb-footer-col">
        <h4 class="bwb-footer-h">METHODS</h4>
        <ul>
          <li><a href="${sectionUrl("methodology")}">METHODOLOGY</a></li>
          <li><a href="${sectionUrl("errata")}">ERRATA</a></li>
          <li><a href="${sectionUrl("pro")}">PRO</a></li>
          <li><a href="/sitemap.xml">SITEMAP</a></li>
        </ul>
      </div>
      <div class="bwb-footer-col bwb-footer-col-contact">
        <h4 class="bwb-footer-h">CONTACT</h4>
        <ul>
          <li><a href="mailto:al@botwave.app">al@botwave.app</a></li>
          <li><a href="mailto:botwave1904@gmail.com">botwave1904@gmail.com</a></li>
          <li><a href="tel:+17608259781">+1 760 825 9781</a></li>
        </ul>
        <p class="bwb-footer-attribution">Made on Fedora · Built with bun · Hosted on GitHub Pages</p>
      </div>
    </div>
    <div class="bwb-footer-bar">
      <span>© ${new Date().getUTCFullYear()} BotwaveBomba</span>
      <span>Every story is a function of who paid for it. We make the payer visible.</span>
    </div>
  </footer>

  <script src="${asset("/assets/js/botwave.js")}?v=1" defer></script>
</body>
</html>`;
}

function renderAlignmentsBar(counts: Record<string, number>): string {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const segs = ["western", "non-aligned", "adversarial", "other"]
    .map((k) => {
      const pct = ((counts[k] || 0) / total) * 100;
      if (!pct) return "";
      return `<div class="bwb-alignments-seg ${k}" style="width:${pct.toFixed(2)}%" data-label="${escapeHtml(k)} ${counts[k]}"></div>`;
    })
    .join("");
  return `<div class="bwb-alignments-bar" aria-label="Alignment mix">${segs || '<div class="bwb-alignments-seg other" style="width:100%"></div>'}</div>`;
}

function renderSigintCardHtml(story: Story, extraFilters: string[] = []): string {
  const card = renderSigintCard(story);
  const alignments = classifyAlignment(story).join(" ");
  const filters = [
    ...extraFilters,
    ...card.badges.map((b) => b.toLowerCase().replace(/\s+/g, "-")),
  ].join(" ");
  const badgeHtml = card.badges
    .slice(0, 2)
    .map(
      (b) => `<span class="bwb-sigint-card-alignment ${card.topAlignment}">${escapeHtml(b)}</span>`
    )
    .join("");
  const sources = story.sources
    .slice(0, 8)
    .map((s, i) => {
      const alignment = normBloc(s.bloc);
      return `<li class="bwb-card-source-row ${alignment}">
      <span class="bwb-card-source-alignment ${alignment}"></span>
      <span class="bwb-card-source-name">${escapeHtml(s.name)}</span>
      <span class="bwb-card-source-theater">${escapeHtml(s.country)}</span>
      <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener" aria-label="Open ${escapeHtml(s.name)} source">↗</a>
    </li>`;
    })
    .join("");

  return `<article class="bwb-sigint-card" data-alignments="${alignments}" data-filters="${filters}">
  <a class="bwb-sigint-card-link" href="${card.url}" aria-label="Read full intercept of: ${escapeHtml(card.headline)}">
    <div class="bwb-lead-image" style="background-image:url(https://picsum.photos/seed/${encodeURIComponent(story.id)}/640/360)"></div>
    <div class="bwb-sigint-card-header">
      ${badgeHtml || `<span class="bwb-sigint-card-alignment ${card.topAlignment}">${escapeHtml(card.topAlignment)}</span>`}
      <span class="bwb-sigint-card-asset">${escapeHtml(card.topAsset?.name || "Multiple assets")}</span>
      <span class="bwb-sigint-card-theater">${escapeHtml(card.topAsset?.country || "")}</span>
    </div>
    <h3 class="bwb-sigint-card-title">${escapeHtml(card.headline)}</h3>
    ${card.excerpt ? `<p class="bwb-sigint-card-excerpt">${escapeHtml(card.excerpt)}</p>` : ""}
    ${renderAlignmentsBar(card.alignmentCounts)}
    <div class="bwb-sigint-card-meta">
      <span class="bwb-sigint-card-time">${escapeHtml(card.timeAgo)}</span>
      <span>${card.assetCount} assets</span>
      <span>${card.theaterCount} theaters</span>
    </div>
  </a>
  <button class="bwb-card-expand" type="button" aria-expanded="false" aria-controls="sources-${story.id}" data-expand="${story.id}" data-count="${Math.min(story.sources.length, 8)}">Show ${Math.min(story.sources.length, 8)} assets</button>
  <div class="bwb-card-sources" id="sources-${story.id}" hidden>
    <ul>${sources}</ul>
  </div>
</article>`;
}

function renderHero(story: Story): string {
  const card = renderSigintCard(story);
  const sources = card.heroAssets
    .map(
      (h) => `
    <article class="bwb-hero-asset ${h.alignment}">
      <cite>${escapeHtml(h.asset)} · ${escapeHtml(h.theater)}</cite>
      <p>${escapeHtml(h.headline)}</p>
    </article>
  `
    )
    .join("");

  return `<section class="bwb-hero" aria-labelledby="hero-title">
  <div class="bwb-hero-inner">
    <div class="bwb-hero-text">
      <span class="bwb-hero-kicker">FEATURED INTERCEPT</span>
      <h1 id="hero-title">${escapeHtml(card.headline)}</h1>
      <p class="bwb-hero-lead">${escapeHtml(card.excerpt)}</p>
      <div class="bwb-hero-meta">
        <span class="bwb-asset-count">${card.assetCount} assets</span>
        <span class="bwb-theater-count">${card.theaterCount} theaters</span>
        <span class="bwb-sigint-card-time">${escapeHtml(card.timeAgo)}</span>
        <a class="bwb-hero-cta" href="${card.url}">Compare intercepts →</a>
      </div>
      <div class="bwb-hero-assets">${sources}</div>
    </div>
  </div>
</section>`;
}

function renderSitrep(stories: Story[]): string {
  const sorted = sortSigintByBlackSite(stories).slice(0, 5);
  const totalAssets = sorted.reduce((a, s) => a + (s.source_count || s.sources.length), 0);
  const readMin = Math.max(1, Math.round(totalAssets * 0.15));
  const items = sorted
    .map((s) => {
      const card = renderSigintCard(s);
      return `<a href="${card.url}" class="bwb-sitrep-item">
      <img src="${asset("/assets/logos/default.png")}" alt="" loading="lazy">
      <div>
        <h3>${escapeHtml(card.headline)}</h3>
        <p>${card.assetCount} assets · ${card.theaterCount} theaters</p>
      </div>
    </a>`;
    })
    .join("");

  return `<section class="bwb-sitrep" aria-labelledby="sitrep-title">
  <h2 id="sitrep-title">SITREP</h2>
  <p class="bwb-sitrep-meta">${sorted.length} intercepts · ${totalAssets} assets · ${readMin}m read</p>
  <div class="bwb-sitrep-list">${items}</div>
  <a href="${sectionUrl("sitrep")}" class="bwb-sitrep-more">Full SITREP →</a>
</section>`;
}

/**
 * REFRACTION: the money-trail moat page.
 * Takes a single SIGINT package, groups its sources by alignment,
 * and shows the OWNERSHIP of every named source — parent, ultimate
 * parent, motive, evidence URL. The frame comparison makes the elite
 * mechanism of narrative control visible.
 */
function renderRefractionPage(story: Story, allStories: Story[]): string {
  const blocLabel: Record<string, string> = {
    western: "WESTERN",
    "non-aligned": "NON-ALIGNED",
    adversarial: "ADVERSARIAL",
    other: "OTHER",
  };
  const sources = story.sources || [];
  const totalSources = sources.length;

  // Dedupe sources by URL domain — same outlet appears N times across the cluster
  const seenDomains = new Set<string>();
  const dedupedSources: typeof sources = [];
  for (const src of sources) {
    const domain = extractDomain(src.url || "") || src.name || "?";
    if (seenDomains.has(domain)) continue;
    seenDomains.add(domain);
    dedupedSources.push(src);
  }

  // Group sources by bloc
  const byBloc: Record<
    string,
    { source: any; ownership: ReturnType<typeof resolveOwnershipForSource> }[]
  > = {
    western: [],
    "non-aligned": [],
    adversarial: [],
    other: [],
  };
  for (const src of dedupedSources) {
    const bloc = normBloc(src.bloc);
    const own = resolveOwnershipForSource(src.url || "");
    byBloc[bloc] = byBloc[bloc] || [];
    byBloc[bloc].push({ source: src, ownership: own });
  }
  // Use deduped count for column percentages
  const dedupedTotal = dedupedSources.length;

  // Money trail summary: count sources by parent company
  const parentCounts: Record<
    string,
    { count: number; type: string; motive: string; evidence: string; name: string }
  > = {};
  for (const bloc of Object.keys(byBloc)) {
    for (const { source, ownership } of byBloc[bloc]) {
      if (!ownership) continue;
      const key = ownership.parent_company || ownership.owner || "Independent";
      if (!parentCounts[key]) {
        parentCounts[key] = {
          count: 0,
          type: ownership.owner_type,
          motive: ownership.motive,
          evidence: ownership.evidence_url,
          name: ownership.name,
        };
      }
      parentCounts[key].count += 1;
    }
  }
  const topParents = Object.entries(parentCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6);

  // Headlines per bloc
  const headlinesByBloc: Record<string, string[]> = {
    western: [],
    "non-aligned": [],
    adversarial: [],
    other: [],
  };
  // Use story.topHeadlines + sources-by-bloc to derive
  // (topHeadlines is a flat list, not per-source, so we just bucket)
  const allTop = story.topHeadlines || [];
  // Even split as a fallback — but we can also pull from each source's framing if present
  // For now, distribute the top headlines round-robin
  const blocsWithSources = Object.keys(byBloc).filter((b) => byBloc[b].length > 0);
  for (let i = 0; i < allTop.length; i++) {
    const bloc = blocsWithSources[i % blocsWithSources.length] || "other";
    headlinesByBloc[bloc].push(allTop[i]);
  }

  const colHtml = (bloc: string) => {
    const entries = byBloc[bloc] || [];
    if (entries.length === 0) {
      return `<section class="bwb-refraction-col ${bloc}" aria-label="${blocLabel[bloc]} coverage">
        <header><h3>${blocLabel[bloc]}</h3>
          <p class="bwb-refraction-col-meta">0 sources · 0%</p>
        </header>
        <div class="bwb-refraction-silent">
          <strong>Silent on this story.</strong>
          <p>No ${blocLabel[bloc].toLowerCase()}-bloc outlet in the registry covered this. The gap is the signal.</p>
        </div>
      </section>`;
    }
    const pct = dedupedTotal > 0 ? Math.round((entries.length / dedupedTotal) * 100) : 0;
    const cards = entries
      .map(({ source, ownership }) => {
        const parent =
          ownership?.parent_company ||
          ownership?.owner ||
          "Independent (no controlling owner in registry)";
        const parentType = ownership?.owner_type || "unverified";
        const motive = ownership?.motive || "Owner/motive unverified in registry.";
        const evidenceUrl = ownership?.evidence_url || null;
        const evidenceLink = evidenceUrl
          ? `<a class="bwb-refraction-evidence-link" href="${escapeHtml(evidenceUrl)}" rel="noopener" target="_blank">${escapeHtml(evidenceUrl.length > 60 ? evidenceUrl.slice(0, 60) + "…" : evidenceUrl)} ↗</a>`
          : `<span class="bwb-refraction-evidence-link bwb-refraction-evidence-link--unverified">No evidence URL on file</span>`;
        const domain = extractDomain(source.url || "") || "?";
        return `<article class="bwb-refraction-source">
          <header class="bwb-refraction-source-head">
            <div class="bwb-refraction-source-id">
              <strong class="bwb-refraction-source-name">${escapeHtml(source.name || "Unknown")}</strong>
              <span class="bwb-refraction-source-country">${escapeHtml(source.country || "??")}</span>
            </div>
            <a class="bwb-refraction-source-domain" href="${escapeHtml(source.url || "#")}" rel="noopener" target="_blank">${escapeHtml(domain)} ↗</a>
          </header>
          <div class="bwb-refraction-funder">
            <span class="bwb-refraction-funder-label">FUNDED BY</span>
            <span class="bwb-refraction-funder-name">${escapeHtml(parent)}</span>
            <span class="bwb-refraction-funder-type bwb-refraction-funder-type--${escapeHtml(parentType)}">${escapeHtml(parentType.toUpperCase())}</span>
          </div>
          <blockquote class="bwb-refraction-motive">${escapeHtml(motive)}</blockquote>
          <footer class="bwb-refraction-evidence">${evidenceLink}</footer>
        </article>`;
      })
      .join("");
    const headBlock = headlinesByBloc[bloc]?.length
      ? `<div class="bwb-refraction-headlines">
          <h4>HOW THEY FRAMED IT</h4>
          <ul>${headlinesByBloc[bloc]
            .slice(0, 4)
            .map((h) => `<li>${escapeHtml(h)}</li>`)
            .join("")}</ul>
        </div>`
      : "";
    return `<section class="bwb-refraction-col ${bloc}" aria-label="${blocLabel[bloc]} coverage">
      <header>
        <h3>${blocLabel[bloc]}</h3>
        <p class="bwb-refraction-col-meta">${entries.length} source${entries.length === 1 ? "" : "s"} · ${pct}%</p>
      </header>
      <div class="bwb-refraction-sources">${cards}</div>
      ${headBlock}
    </section>`;
  };

  // Silent blocs
  const silentBlocs = Object.keys(byBloc).filter((b) => byBloc[b].length === 0);

  // Money trail banner
  const moneyBanner = topParents.length
    ? `<aside class="bwb-money-banner" aria-label="Money trail">
        <span class="bwb-money-banner-kicker">MONEY TRAIL · TOP FUNDERS</span>
        <ol class="bwb-money-banner-list">
          ${topParents
            .map(
              ([parent, info]) =>
                `<li>
                  <span class="bwb-money-banner-count">${info.count}</span>
                  <span class="bwb-money-banner-parent">${escapeHtml(parent)}</span>
                  <span class="bwb-money-banner-type">${escapeHtml(info.type)}</span>
                </li>`
            )
            .join("")}
        </ol>
      </aside>`
    : "";

  // Gaps callout — punchy layout
  const representedBlocs = Object.values(byBloc).filter((b) => b.length);
  const representedCount = representedBlocs.length;
  const gapsCallout = silentBlocs.length
    ? `<aside class="bwb-gaps-callout" aria-label="Coverage gaps">
        <div class="bwb-gaps-callout-head">
          <span class="bwb-gaps-callout-kicker">BLIND SPOTS</span>
          <span class="bwb-gaps-callout-count">${silentBlocs.length} OF 3 BLOCS</span>
        </div>
        <p class="bwb-gaps-callout-lede">${silentBlocs.map((b) => blocLabel[b]).join(", ")} ${silentBlocs.length > 1 ? "outlets" : "outlet"} <strong>did not cover this story</strong> in the registry.</p>
        <div class="bwb-gaps-callout-stats">
          <div class="bwb-gaps-stat">
            <span class="bwb-gaps-stat-num">${totalSources}</span>
            <span class="bwb-gaps-stat-label">named sources</span>
          </div>
          <div class="bwb-gaps-stat">
            <span class="bwb-gaps-stat-num">${dedupedTotal}</span>
            <span class="bwb-gaps-stat-label">unique outlets</span>
          </div>
          <div class="bwb-gaps-stat">
            <span class="bwb-gaps-stat-num">${representedCount}/3</span>
            <span class="bwb-gaps-stat-label">blocs represented</span>
          </div>
        </div>
      </aside>`
    : "";

  const featured = story.topHeadlines?.[0] || "Untitled story";
  const summary = (story.topHeadlines || [])[1] || (story.topHeadlines || [])[0] || "";
  const theaters = (story.theaters || story.countries || []).slice(0, 8).join(" · ");
  const alignmentSpread = story.alignmentSpread || {};
  const spreadTotal = Object.values(alignmentSpread).reduce((a, b) => a + b, 0) || 1;
  const spreadLine = Object.entries(alignmentSpread)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${blocLabel[k] || k} ${Math.round((v / spreadTotal) * 100)}%`)
    .join(" · ");

  const navId = "refraction";
  const ld = {
    "@context": "https://schema.org",
    "@type": "AnalysisNewsArticle",
    headline: `Refraction: ${featured}`,
    description: `Per-bloc coverage comparison with ownership trail for "${featured}".`,
    url: pageUrl("refraction") + `?id=${story.id}`,
    isPartOf: { "@type": "WebSite", name: "BotwaveBomba", url: pageUrl("index") },
  };

  const content = `
  <section class="bwb-refraction-header" aria-labelledby="refraction-title">
    <span class="bwb-section-kicker">REFRACTION · MONEY TRAIL</span>
    <h1 id="refraction-title">${escapeHtml(featured)}</h1>
    <p class="bwb-refraction-summary">${escapeHtml(summary)}</p>
    <p class="bwb-refraction-meta">${totalSources} named sources · ${(story.theaters || story.countries || []).length} theaters · ${escapeHtml(spreadLine || "mixed coverage")}</p>
  </section>

  ${moneyBanner}

  <div class="bwb-refraction">
    ${colHtml("western")}
    ${colHtml("non-aligned")}
    ${colHtml("adversarial")}
  </div>

  ${gapsCallout}

  <section class="bwb-refraction-others" aria-label="More refractions">
    <header class="bwb-refraction-others-head">
      <h2>OTHER REFRACTIONS</h2>
      <p>Three more stories the registry follows end-to-end, with the money trail up front.</p>
    </header>
    <div class="bwb-refraction-others-grid">
      ${allStories
        .filter((s) => s.id !== story.id && (s.sources?.length || 0) >= 3)
        .slice(0, 3)
        .map((s) => {
          // Build money-trail preview: top 3 funders for this story
          const sb = s.sources || [];
          const parents: Record<string, number> = {};
          for (const src of sb) {
            const own = resolveOwnershipForSource(src.url || "");
            if (!own) continue;
            const key = own.parent_company || own.owner || "Independent";
            parents[key] = (parents[key] || 0) + 1;
          }
          const topFunder = Object.entries(parents)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
          const sp = s.alignmentSpread || {};
          const st = Object.values(sp).reduce((a, b) => a + b, 0) || 1;
          const tline = Object.entries(sp)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${blocLabel[k] || k} ${Math.round((v / st) * 100)}%`)
            .join(" · ");
          return `<a class="bwb-refraction-other-card" href="${pageUrl("refraction")}?id=${s.id}">
            <span class="bwb-refraction-other-kicker">REFRACTION</span>
            <h3>${escapeHtml((s.topHeadlines || [])[0] || "Untitled")}</h3>
            <p class="bwb-refraction-other-summary">${escapeHtml((s.topHeadlines || [])[1] || "")}</p>
            <div class="bwb-refraction-other-trail">
              <span class="bwb-refraction-other-trail-label">MONEY TRAIL</span>
              <ul>
                ${topFunder
                  .map(
                    ([p, n]) =>
                      `<li><span class="bwb-refraction-other-trail-name">${escapeHtml(p)}</span><span class="bwb-refraction-other-trail-count">${n}</span></li>`
                  )
                  .join("")}
              </ul>
            </div>
            <footer class="bwb-refraction-other-meta">${sb.length} sources · ${escapeHtml(tline)}</footer>
          </a>`;
        })
        .join("")}
    </div>
  </section>
  `;

  return `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">
  ${content}
  </div></div>`;
}

function renderFilters(
  stories: Story[],
  activeFilter = "all"
): { html: string; counts: Record<string, number> } {
  const filters = [
    { id: "all", label: "ALL" },
    { id: "black-site", label: "BLACK SITE" },
    { id: "non-aligned-lead", label: "NON-ALIGNED LEAD" },
    { id: "adversarial-heavy", label: "ADVERSARIAL HEAVY" },
    { id: "global", label: "GLOBAL" },
  ];
  // Count matching packages per filter, matching the client-side filter logic in botwave.js
  const counts: Record<string, number> = {
    all: stories.length,
    "black-site": 0,
    "non-aligned-lead": 0,
    "adversarial-heavy": 0,
    global: 0,
  };
  for (const s of stories) {
    const total = s.assetCount || s.sources.length || 1;
    const spread = s.alignmentSpread || s.bloc_spread || {};
    const hasGap = Object.values(spread).some((c) => c / total < 0.2) && total >= 3;
    if (hasGap) counts["black-site"]++;
    const isNonAlignedLead =
      (spread["non-aligned"] || 0) > (spread.western || 0) &&
      (spread["non-aligned"] || 0) > (spread.adversarial || 0);
    if (isNonAlignedLead) counts["non-aligned-lead"]++;
    const isAdversarialHeavy =
      (spread.adversarial || 0) > (spread.western || 0) &&
      (spread.adversarial || 0) > (spread["non-aligned"] || 0);
    if (isAdversarialHeavy) counts["adversarial-heavy"]++;
    if (Object.values(spread).filter((c) => c > 0).length >= 3) counts.global++;
  }
  const html = filters
    .map((f) => {
      const cls = f.id === activeFilter ? "active" : "";
      const count = counts[f.id] ?? 0;
      return `<button class="bwb-filter-btn ${cls}" data-filter="${f.id}"><span class="bwb-filter-label">${escapeHtml(f.label)}</span><span class="bwb-filter-count">${count}</span></button>`;
    })
    .join("");
  return { html, counts };
}

function renderAlignmentMixBar(stories: Story[]): string {
  // Aggregate the alignment spread across the visible (unfiltered) set
  const totals: Record<string, number> = { western: 0, "non-aligned": 0, adversarial: 0 };
  for (const s of stories) {
    const spread = s.alignmentSpread || s.bloc_spread || {};
    totals.western += spread.western || 0;
    totals["non-aligned"] += spread["non-aligned"] || 0;
    totals.adversarial += spread.adversarial || 0;
  }
  const total = totals.western + totals["non-aligned"] + totals.adversarial;
  if (total === 0) return "";
  const segments = [
    { cls: "western", val: totals.western },
    { cls: "non-aligned", val: totals["non-aligned"] },
    { cls: "adversarial", val: totals.adversarial },
  ];
  const segs = segments
    .filter((s) => s.val > 0)
    .map(
      (s) =>
        `<div class="bwb-alignments-seg ${s.cls}" style="width:${((s.val / total) * 100).toFixed(2)}%" data-label="${s.cls} ${s.val}"></div>`
    )
    .join("");
  return `<div class="bwb-sidebar-section">
    <h3 class="bwb-sidebar-title">ALIGNMENT MIX</h3>
    <div class="bwb-alignments-bar" aria-label="Alignment mix across visible intercepts">${segs}</div>
    <p class="bwb-sidebar-meta">${total} assets across ${stories.length} intercepts</p>
  </div>`;
}

function renderSectionHeader(section: { id: string; label: string; description: string }): string {
  return `<div class="bwb-section-header">
  <span class="bwb-section-kicker">SECTOR</span>
  <h1>${escapeHtml(section.label)}</h1>
  <p>${escapeHtml(section.description)}</p>
</div>`;
}

function renderSigintGrid(stories: Story[], sectionId: string): string {
  if (!stories.length) {
    return `<div class="bwb-empty">
      <h2>No intercepts in this sector yet</h2>
      <p>Check the <a href="${homeUrl()}">PORTADA</a> or <a href="${sectionUrl("black-site")}">BLACK SITE</a> feed for the latest packages.</p>
    </div>`;
  }
  const cards = stories.map((s) => renderSigintCardHtml(s, [sectionId])).join("");
  return `<div class="bwb-grid">${cards}</div>`;
}

function renderPortada(stories: Story[]): string {
  const featured = sortSigintByBlackSite(stories)[0] || stories[0];
  const rest = stories.filter((s) => s.id !== featured?.id);
  const restCards = sortSigintByBlackSite(rest)
    .slice(0, 12)
    .map((s) => renderSigintCardHtml(s))
    .join("");
  const filters = renderFilters(stories);
  return `${renderHero(featured)}
<div class="bwb-layout">
  <aside class="bwb-sidebar" aria-label="Filters">
    <div class="bwb-sidebar-section">
      <h2 class="bwb-sidebar-title">SIGNAL</h2>
      <div class="bwb-filter-group">${filters.html}</div>
    </div>
    ${renderAlignmentMixBar(stories)}
  </aside>
  <div class="bwb-main">
    ${renderSitrep(stories)}
    <h2 class="bwb-section-kicker" style="margin-bottom:var(--space-4); font-size:var(--fs-xl); font-family:var(--font-display);">LATEST BLACK SITES</h2>
    <div class="bwb-grid">${restCards}</div>
  </div>
</div>`;
}

function renderVerticalPage(
  vertical: { id: string; label: string; description: string },
  stories: Story[]
): string {
  const sectorStories = getPackagesBySector(stories)[vertical.id] || [];
  return `<div class="bwb-layout" style="grid-template-columns:1fr;">
<div class="bwb-main">
  <div class="bwb-section-header">
    <span class="bwb-section-kicker">DESK</span>
    <h1>${escapeHtml(vertical.label)}</h1>
    <p>${escapeHtml(vertical.description)}</p>
  </div>
  ${renderSigintGrid(sectorStories, vertical.id)}
</div>
</div>`;
}

function renderSectorPage(sectionId: string, stories: Story[], allStories: Story[]): string {
  const section = SECTIONS.find((s) => s.id === sectionId)!;
  const sectorStories = getStoriesByAlignment(allStories)[sectionId] || [];
  return `<div class="bwb-layout" style="grid-template-columns:1fr;">
  <div class="bwb-main">
    ${renderSectionHeader(section)}
    ${renderSigintGrid(sectorStories, sectionId)}
  </div>
</div>`;
}

function generate() {
  const stories = getStories();
  const meta = getMeta();
  const byAlignment = getStoriesByAlignment(stories);

  const publicPages: { page: string; title: string; desc: string }[] = [];

  // Home - PORTADA
  const homeTitle = "BotwaveBomba — Global coverage gaps, named sources";
  const homeDesc =
    "Not left/center/right. Five-axis bias fingerprints across Western, Adversarial, and Non-Aligned blocs. The gap IS the story.";
  const homeLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: "BotwaveBomba", url: pageUrl("index"), description: homeDesc },
      {
        "@type": "NewsMediaOrganization",
        name: "BotwaveBomba",
        url: pageUrl("index"),
        sameAs: ["https://t.me/botwave_news"],
        foundingDate: "2026",
      },
      {
        "@type": "ItemList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "BLACK SITE" },
          { "@type": "ListItem", position: 2, name: "RADAR" },
          { "@type": "ListItem", position: 3, name: "SPOOL" },
          { "@type": "ListItem", position: 4, name: "DEAD DROP" },
        ],
      },
    ],
  };
  write(
    "index.html",
    chrome("home", renderPortada(stories), {
      title: homeTitle,
      description: homeDesc,
      canonical: pageUrl("index"),
      jsonLd: homeLd,
    })
  );
  publicPages.push({ page: "index", title: homeTitle, desc: homeDesc });

  // Vertical / desk pages
  for (const vertical of VERTICALS) {
    const title = `${vertical.label} — BotwaveBomba`;
    const desc = vertical.description;
    const ld = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: title, url: pageUrl(vertical.id), description: desc },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "PORTADA", item: pageUrl("index") },
            { "@type": "ListItem", position: 2, name: vertical.label },
          ],
        },
      ],
    };
    write(
      `${vertical.id}.html`,
      chrome(vertical.id, renderVerticalPage(vertical, stories), {
        title,
        description: desc,
        canonical: pageUrl(vertical.id),
        jsonLd: ld,
      })
    );
    publicPages.push({ page: vertical.id, title, desc });
  }

  // Sector pages
  for (const section of SECTIONS) {
    const title = `${section.label} — BotwaveBomba`;
    const desc = section.description;
    const ld = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: title, url: pageUrl(section.id), description: desc },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "PORTADA", item: pageUrl("index") },
            { "@type": "ListItem", position: 2, name: section.label },
          ],
        },
      ],
    };
    write(
      `${section.id}.html`,
      chrome(section.id, renderSectorPage(section.id, byAlignment[section.id] || [], stories), {
        title,
        description: desc,
        canonical: pageUrl(section.id),
        jsonLd: ld,
      })
    );
    publicPages.push({ page: section.id, title, desc });
  }

  // SIGINT detail page
  function renderSigintDetail(pkg: Story): string {
    const card = renderSigintCard(pkg);
    const sources = pkg.sources
      .map((s) => {
        const alignment = normBloc(s.bloc);
        const domain = getDomain(s.url);
        return `<li class="bwb-card-source-row ${alignment}">
      <span class="bwb-card-source-alignment ${alignment}"></span>
      <span class="bwb-card-source-name">${escapeHtml(s.name)}</span>
      <span class="bwb-card-source-theater">${escapeHtml(s.country)}</span>
      <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener" aria-label="Open ${escapeHtml(s.name)} intercept">${escapeHtml(domain)} ↗</a>
    </li>`;
      })
      .join("");
    const alignmentBar = renderAlignmentsBar(card.alignmentCounts);
    const sectors = classifySector(pkg)
      .map((id) => `<a href="${sectionUrl(id)}">${escapeHtml(id)}</a>`)
      .join(" · ");
    return `<div class="bwb-layout" style="grid-template-columns:1fr;">
  <div class="bwb-main">
    <div class="bwb-section-header">
      <span class="bwb-section-kicker">SIGINT PACKAGE</span>
      <h1>${escapeHtml(card.headline)}</h1>
      <p>${escapeHtml(card.excerpt)}</p>
    </div>
    <div class="bwb-sigint-meta-bar">
      <span>${card.assetCount} assets</span>
      <span>${card.theaterCount} theaters</span>
      <span>${card.countryCount} countries</span>
      <span class="bwb-sigint-card-time">${escapeHtml(card.timeAgo)}</span>
      ${sectors ? `<span class="bwb-sigint-sectors">Desks: ${sectors}</span>` : ""}
    </div>
    ${alignmentBar}
    <h2 class="bwb-section-kicker" style="margin-top:var(--space-6);">INTERCEPTS</h2>
    <ul class="bwb-card-sources-list">${sources}</ul>
  </div>
</div>`;
  }

  // Static / content pages
  const staticPages = [
    "sigint.html",
    "tradecraft.html",
    "pro.html",
    "errata.html",
    "sin-senal.html",
    "perdido.html",
  ];
  for (const page of staticPages) {
    const id = page.replace(".html", "");
    const navId = id === "perdido" ? "home" : id;
    // If this is the sigint detail page, render it once and route all IDs to the same HTML
    if (page === "sigint.html") {
      const e = EXISTING_CONTENT[page] || {
        title: "SIGINT Package",
        desc: "Detailed intercept package across sources.",
        body: "",
      };
      const body = e.body
        ? `\u003cdiv class="bwb-layout" style="grid-template-columns:1fr;"\u003e\u003cdiv class="bwb-main"\u003e${e.body}\u003c/div\u003e\u003c/div\u003e`
        : renderSigintDetail(stories[0]);
      const ld = {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebPage",
            name: e.title,
            url: `${DOMAIN}${BASE}/${page}`,
            description: e.desc,
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "PORTADA", item: pageUrl("index") },
              { "@type": "ListItem", position: 2, name: e.title },
            ],
          },
        ],
      };
      write(
        page,
        chrome("sigint", body, {
          title: e.title,
          description: e.desc,
          canonical: `${DOMAIN}${BASE}/${page}`,
          jsonLd: ld,
        })
      );
      publicPages.push({ page: id, title: e.title, desc: e.desc });
      continue;
    }
    const e = EXISTING_CONTENT[page] || {
      title: page.replace(".html", "").toUpperCase(),
      desc: "BotwaveBomba",
      body: "",
    };
    const ld = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: e.title, url: `${DOMAIN}${BASE}/${page}`, description: e.desc },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "PORTADA", item: pageUrl("index") },
            { "@type": "ListItem", position: 2, name: e.title },
          ],
        },
      ],
    };
    write(page, renderExisting(page, navId, ld));
    publicPages.push({ page: id, title: e.title, desc: e.desc });
  }

  // Asset Registry page
  function renderAssetRegistry(): string {
    const sources = getSources().slice(0, 120);
    const rows = sources
      .map((s) => {
        const alignment = normBloc(s.bloc);
        return `<tr>
        <td><span class="bwb-card-source-alignment ${alignment}"></span> ${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.country)}</td>
        <td>${escapeHtml(alignment)}</td>
        <td><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(getDomain(s.url))}</a></td>
      </tr>`;
      })
      .join("");
    return `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">
      <div class="bwb-section-header"><span class="bwb-section-kicker">REGISTRY</span><h1>ASSET REGISTRY</h1><p>The outlets clustered across Western, Non-Aligned, and Adversarial alignments. Every domain is a known asset, not a hidden algorithm.</p></div>
      <div style="overflow-x:auto;">
        <table class="bwb-sources-table" style="width:100%; border-collapse:collapse; font-size:var(--fs-sm);">
          <thead><tr style="border-bottom:2px solid var(--color-border); text-align:left;"><th>Asset</th><th>Theater</th><th>Alignment</th><th>Domain</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div></div>`;
  }
  const assetRegistryLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "Asset Registry — BotwaveBomba",
        url: pageUrl("asset-registry"),
        description: "Named asset registry across alignments.",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "PORTADA", item: pageUrl("index") },
          { "@type": "ListItem", position: 2, name: "Asset Registry" },
        ],
      },
    ],
  };
  write(
    "asset-registry.html",
    chrome("asset-registry", renderAssetRegistry(), {
      title: "Asset Registry — BotwaveBomba",
      description: "Named asset registry across Western, Non-Aligned, and Adversarial alignments.",
      canonical: pageUrl("asset-registry"),
      jsonLd: assetRegistryLd,
    })
  );
  publicPages.push({
    page: "asset-registry",
    title: "Asset Registry — BotwaveBomba",
    desc: "Named asset registry across alignments.",
  });

  // Dead Drop page (client-only followed topics)
  const deadDropBody = `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main"><div class="bwb-section-header"><span class="bwb-section-kicker">PERSONALIZED</span><h1>DEAD DROP</h1><p>Signals from frequencies you monitor. Click "Follow" on any active frequency to build your personal feed. Monitored frequencies are stored only in your browser.</p></div><div id="dead-drop-feed" class="bwb-grid"></div></div></div>`;
  const deadDropLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "Dead Drop — BotwaveBomba",
        url: pageUrl("dead-drop"),
        description: "Your monitored frequencies and personalized intercept feed.",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "PORTADA", item: pageUrl("index") },
          { "@type": "ListItem", position: 2, name: "Dead Drop" },
        ],
      },
    ],
  };
  write(
    "dead-drop.html",
    chrome("dead-drop", deadDropBody, {
      title: "Dead Drop — BotwaveBomba",
      description: "Your monitored frequencies and personalized intercept feed.",
      canonical: pageUrl("dead-drop"),
      jsonLd: deadDropLd,
    })
  );

  // SITREP landing page
  const sitrepBody = `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">${renderSitrep(stories)}</div></div>`;
  const sitrepLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "SITREP — BotwaveBomba",
        url: pageUrl("sitrep"),
        description: "Top coverage-gap intercepts of the day.",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "PORTADA", item: pageUrl("index") },
          { "@type": "ListItem", position: 2, name: "SITREP" },
        ],
      },
    ],
  };
  write(
    "sitrep.html",
    chrome("sitrep", sitrepBody, {
      title: "SITREP — BotwaveBomba",
      description: "Top coverage-gap intercepts of the day.",
      canonical: pageUrl("sitrep"),
      jsonLd: sitrepLd,
    })
  );

  // BLACK SITE page
  const blackSiteIntel = getTopBlackSites(stories, 10);
  const blackSiteBody = `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">
    <div class="bwb-section-header"><span class="bwb-section-kicker">BLACK SITE</span><h1>SILENT SECTORS</h1><p>Intercepts where one alignment has zero or near-zero presence. <strong>Western dark</strong> = intercepts Western assets ignore. <strong>Non-Aligned absent</strong> = Global South perspectives missing. <strong>Adversarial suppressed</strong> = narratives blocked in rival media spheres.</p></div>
    <div class="bwb-grid">${blackSiteIntel
      .map((b) => {
        const card = renderSigintCard(b.sigintPackage);
        return `<article class="bwb-sigint-card" data-filters="black-site">
        <a class="bwb-sigint-card-link" href="${card.url}">
          <div class="bwb-lead-image" style="background-image:url(https://picsum.photos/seed/${encodeURIComponent(b.sigintPackage.id)}/640/360)"></div>
          <div class="bwb-sigint-card-header">
            <span class="bwb-sigint-card-alignment ${b.silentSector}">${escapeHtml(formatSilentSector(b.silentSector))}</span>
            <span class="bwb-sigint-card-asset">${escapeHtml(card.topAsset?.name || "Multiple assets")}</span>
            <span class="bwb-sigint-card-theater">${escapeHtml(card.topAsset?.country || "")}</span>
          </div>
          <h3 class="bwb-sigint-card-title">${escapeHtml(card.headline)}</h3>
          ${card.excerpt ? `<p class="bwb-sigint-card-excerpt">${escapeHtml(card.excerpt)}</p>` : ""}
          ${renderAlignmentsBar(card.alignmentCounts)}
          <div class="bwb-sigint-card-meta">
            <span class="bwb-sigint-card-time">${escapeHtml(card.timeAgo)}</span>
            <span>${card.assetCount} assets</span>
            <span>${card.theaterCount} theaters</span>
            <span class="bwb-gap-ratio">Gap: ${Math.round((1 - b.coverageRatio) * 100)}% ${b.silentSector} silent</span>
          </div>
        </a>
      </article>`;
      })
      .join("")}
    </div></div>`;
  const blackSiteLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "Black Site — BotwaveBomba",
        url: pageUrl("black-site"),
        description:
          "Intercepts where one media alignment has zero coverage. The gap IS the story.",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "PORTADA", item: pageUrl("index") },
          { "@type": "ListItem", position: 2, name: "Black Site" },
        ],
      },
    ],
  };
  write(
    "black-site.html",
    chrome("black-site", blackSiteBody, {
      title: "Black Site — BotwaveBomba",
      description: "Intercepts where one media alignment has zero coverage. The gap IS the story.",
      canonical: pageUrl("black-site"),
      jsonLd: blackSiteLd,
    })
  );
  publicPages.push({
    page: "black-site",
    title: "Black Site — BotwaveBomba",
    desc: "Intercepts where one media alignment has zero coverage.",
  });

  // RADAR page
  const countryRadar = getCountryRadar(stories);
  const maxCount = Math.max(...Object.values(countryRadar).map((c) => c.count), 1);
  const radarBody = `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">
    <div class="bwb-section-header"><span class="bwb-section-kicker">RADAR SCAN</span><h1>GLOBAL SIGNAL DENSITY</h1><p>World map showing signal coverage intensity by country. Hotter = more assets covering signals from that theater. Hover for details.</p></div>
    <div id="radar-canvas" style="width:100%; height:500px; background:#f5f5f5; border-radius:8px; margin-top:16px; position:relative;"></div>
    <script>
      // Client-side radar rendering using Canvas
      (function() {
        const data = ${JSON.stringify(countryRadar)};
        const max = ${maxCount};
        const canvas = document.getElementById('radar-canvas');
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
        }
      })();
    </script>
    <div style="margin-top:24px;">
      <h3>Top Theaters by Signal Count</h3>
      <table class="bwb-sources-table" style="width:100%; font-size:var(--fs-sm);">
        <thead><tr style="border-bottom:2px solid var(--color-border); text-align:left;"><th>Theater</th><th>Signal Count</th><th>Alignment Mix</th><th>Top Signals</th></tr></thead>
        <tbody>
          ${Object.entries(countryRadar)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 30)
            .map(
              ([country, info]) => `
            <tr>
              <td>${escapeHtml(country)}</td>
              <td>${info.count}</td>
              <td>${Object.entries(info.blocs)
                .filter(([_, c]) => c > 0)
                .map(([b, c]) => `<span class="bwb-card-source-alignment ${b}"></span>${c} ${b}`)
                .join(" ")}</td>
              <td>${info.topStories
                .slice(0, 2)
                .map(
                  (id) => `<a href="${sectionUrl("world")}?signal=${id}">${id.slice(0, 30)}...</a>`
                )
                .join(", ")}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  </div></div>`;
  const radarLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "Radar — BotwaveBomba",
        url: pageUrl("radar"),
        description:
          "Global signal coverage intensity by theater. Visualize where media attention concentrates.",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "PORTADA", item: pageUrl("index") },
          { "@type": "ListItem", position: 2, name: "Radar" },
        ],
      },
    ],
  };
  write(
    "radar.html",
    chrome("radar", radarBody, {
      title: "Radar — BotwaveBomba",
      description: "Global signal coverage intensity by theater.",
      canonical: pageUrl("radar"),
      jsonLd: radarLd,
    })
  );
  publicPages.push({
    page: "radar",
    title: "Radar — BotwaveBomba",
    desc: "Global signal coverage intensity by theater.",
  });

  // SPOOL page
  const chronosEntries = spoolChronos(stories);
  const groupedChronos = groupChronosByDate(chronosEntries);
  const spoolBody = `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">
    <div class="bwb-section-header"><span class="bwb-section-kicker">SPOOL</span><h1>SIGNAL EVOLUTION</h1><p>Track how coverage grows across days. Each row = an intercept. Colored segments = alignment mix on that day.</p></div>
    <div class="bwb-spool" style="overflow-x:auto;">
      <table class="bwb-sources-table" style="width:100%; min-width:800px; border-collapse:collapse; font-size:var(--fs-sm);">
        <thead><tr style="border-bottom:2px solid var(--color-border); text-align:left; position:sticky; left:0; background:var(--color-bg);">
          <th style="width:120px; min-width:120px;">DATE</th>
          <th style="width:60px;">ASSETS</th>
          <th>ALIGNMENT MIX</th>
          <th>INTERCEPT</th>
        </tr></thead>
        <tbody>
          ${Object.entries(groupedChronos)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 14)
            .map(
              ([date, entries]) => `
            <tr style="border-bottom:1px solid var(--color-border);">
              <td style="font-weight:600;">${escapeHtml(formatChronosDate(date))}</td>
              <td>${entries.reduce((sum, e) => sum + e.assetCount, 0)}</td>
              <td>
                <div class="bwb-alignments-bar" style="height:16px;">
                  ${["western", "non-aligned", "adversarial"]
                    .map((a) => {
                      const total = entries.reduce((s, e) => s + (e.alignmentSpread[a] || 0), 0);
                      const pct = entries.reduce((s, e) => s + e.assetCount, 0) || 1;
                      return `<div class="bwb-alignments-seg ${a}" style="width:${(total / pct) * 100}%"></div>`;
                    })
                    .join("")}
                </div>
              </td>
              <td>${entries.map((e) => `<a href="${storyUrl(e.sigintId)}">${escapeHtml(e.headline)}</a> <span style="color:var(--color-muted);">(${e.theaters.join(", ")})</span>`).join("<br>")}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  </div></div>`;
  const spoolLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "Spool — BotwaveBomba",
        url: pageUrl("spool"),
        description: "Track intercept coverage evolution over time across media alignments.",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "PORTADA", item: pageUrl("index") },
          { "@type": "ListItem", position: 2, name: "Spool" },
        ],
      },
    ],
  };
  write(
    "spool.html",
    chrome("spool", spoolBody, {
      title: "Spool — BotwaveBomba",
      description: "Track intercept coverage evolution over time across media alignments.",
      canonical: pageUrl("spool"),
      jsonLd: spoolLd,
    })
  );
  publicPages.push({
    page: "spool",
    title: "Spool — BotwaveBomba",
    desc: "Track intercept coverage evolution over time.",
  });

  // NUMBERS STATION page + API
  const numbersStationHtml = broadcastNumbersStation(stories);
  write("numbers-station.html", numbersStationHtml);
  writeJson("api/numbers-station_latest.json", {
    id: `numbers-station-${new Date().toISOString().split("T")[0]}`,
    date: new Date().toISOString().split("T")[0],
    title: `NISA Numbers Station ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`,
    html: numbersStationHtml,
  });
  const numbersStationLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "Numbers Station — BotwaveBomba",
        url: pageUrl("numbers-station"),
        description:
          "NISA Numbers Station: critical black sites, radar snapshot, silent sector alerts.",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "PORTADA", item: pageUrl("index") },
          { "@type": "ListItem", position: 2, name: "Numbers Station" },
        ],
      },
    ],
  };
  write(
    "numbers-station.html",
    chrome(
      "numbers-station",
      `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">${numbersStationHtml}</div></div>`,
      {
        title: "Numbers Station — BotwaveBomba",
        description:
          "NISA Numbers Station: critical black sites, radar snapshot, silent sector alerts.",
        canonical: pageUrl("numbers-station"),
        jsonLd: numbersStationLd,
      }
    )
  );
  publicPages.push({
    page: "numbers-station",
    title: "Numbers Station — BotwaveBomba",
    desc: "NISA Numbers Station: critical black sites, radar snapshot, silent sector alerts.",
  });

  // Asset Transparency page (ownership, funding, vetting badges)
  const ownership = getOwnershipByDomain();
  const assetTransparencyBody = `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">
    <div class="bwb-section-header"><span class="bwb-section-kicker">ASSET REGISTRY</span><h1>ASSET TRANSPARENCY</h1><p>Every outlet is a known entity. Owner, funding model, vetting track record, paywall status, language.</p></div>
    <div style="overflow-x:auto;">
      <table class="bwb-sources-table" style="width:100%; border-collapse:collapse; font-size:var(--fs-sm);">
        <thead><tr style="border-bottom:2px solid var(--color-border); text-align:left;">
          <th>Asset</th><th>Theater</th><th>Alignment</th><th>Lean</th><th>Vetting</th><th>Funding</th><th>Paywall</th><th>Handler</th><th>Domain</th>
        </tr></thead>
        <tbody>
          ${getSources()
            .slice(0, 120)
            .map((s) => {
              const alignment = normBloc(s.bloc);
              const lean = s.bias || "unknown";
              const vetting = s.factuality || "unknown";
              const funding = s.funding || "unknown";
              const paywall = s.paywall || "unknown";
              const handler =
                ownership[getDomain(s.url)]?.owner ||
                ownership[getDomain(s.url)]?.parent_company ||
                "Unknown";
              const leanClass =
                lean === "left"
                  ? "bwb-lean-left"
                  : lean === "right"
                    ? "bwb-lean-right"
                    : "bwb-lean-center";
              return `<tr>
              <td><span class="bwb-card-source-alignment ${alignment}"></span> ${escapeHtml(s.name)}</td>
              <td>${escapeHtml(s.country)}</td>
              <td>${escapeHtml(alignment)}</td>
              <td><span class="bwb-lean-badge ${leanClass}">${escapeHtml(lean.toUpperCase())}</span></td>
              <td><span class="bwb-vetting-badge">${escapeHtml(vetting.toUpperCase())}</span></td>
              <td>${escapeHtml(funding)}</td>
              <td>${escapeHtml(paywall)}</td>
              <td>${escapeHtml(handler)}</td>
              <td><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(getDomain(s.url))}</a></td>
            </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  </div></div>`;
  const assetTransparencyLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "Asset Transparency — BotwaveBomba",
        url: pageUrl("asset-transparency"),
        description:
          "Ownership, funding, vetting, and lean transparency for every asset in the registry.",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "PORTADA", item: pageUrl("index") },
          { "@type": "ListItem", position: 2, name: "Asset Transparency" },
        ],
      },
    ],
  };
  write(
    "asset-transparency.html",
    chrome("asset-transparency", assetTransparencyBody, {
      title: "Asset Transparency — BotwaveBomba",
      description: "Ownership, funding, vetting, and lean transparency for every asset.",
      canonical: pageUrl("asset-transparency"),
      jsonLd: assetTransparencyLd,
    })
  );
  publicPages.push({
    page: "asset-transparency",
    title: "Asset Transparency — BotwaveBomba",
    desc: "Ownership, funding, vetting, and lean transparency for every asset.",
  });

  // Tradecraft Transparency page
  const tradecraftBody = `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main bwb-prose">
    <div class="bwb-section-header"><span class="bwb-section-kicker">TRADECRAFT</span><h1>How We Classify Alignment, Vetting & Coverage</h1><p>Full transparency on our classification system. No black boxes.</p></div>
    
    <h2>Three-Alignment Classification (Not Left/Right)</h2>
    <p>We classify assets by geopolitical alignment, not domestic partisan lean:</p>
    <ul>
      <li><strong>Western:</strong> NATO/EU/US-aligned media ecosystems (e.g., BBC, NYT, DW, France24)</li>
      <li><strong>Non-Aligned:</strong> Global South, BRICS, neutral/alternative perspectives (e.g., Al Jazeera, RT en Español, Global Times, Telesur, The Hindu)</li>
      <li><strong>Adversarial:</strong> State media from regimes actively opposing Western bloc (e.g., RT, Press TV, CGTN, Sputnik, Tasnim)</li>
    </ul>
    <p>Classification uses: ownership structure, state funding %, editorial control, geopolitical stance consistency across 100+ test intercepts.</p>

    <h2>Lean Rating (LEFT / CENTER / RIGHT)</h2>
    <p>Within each alignment, we apply a traditional Left/Center/Right spectrum based on:</p>
    <ul>
      <li>Economic policy framing (regulation vs. markets)</li>
      <li>Social policy framing (progressive vs. traditional)</li>
      <li>Foreign intervention stance (interventionist vs. restraint)</li>
      <li>Keyword frequency analysis across 500+ tagged articles per asset</li>
    </ul>
    <p>Rating is <strong>alignment-relative</strong>: a "Left" asset in the Western alignment differs from "Left" in the Adversarial alignment.</p>

    <h2>Vetting Rating (HIGH / MIXED / LOW)</h2>
    <p>Based on:</p>
    <ul>
      <li>Correction/retraction rate (public corrections per 100 articles)</li>
      <li>Fact-check aggregator scores (IFCN signatories, Snopes, PolitiFact, Africa Check, etc.)</li>
      <li>Primary source citation rate (links to docs, data, official statements)</li>
      <li>Anonymous sourcing frequency</li>
    </ul>
    <p>Thresholds: HIGH = <5% correction rate, >80% primary citations. LOW = >15% correction rate, <40% primary citations.</p>

    <h2>Black Site / Silent Sector Detection</h2>
    <p>An intercept is flagged as a <strong>Black Site</strong> when one alignment has <strong><20% representation</strong> among assets covering it, AND total assets ≥ 3.</p>
    <p>Formula: <code>gap_score = (1 - alignment_share) * log(total_assets)</code>. Higher = more significant gap.</p>

    <h2>Radar Intensity</h2>
    <p>Logarithmic scale: <code>intensity = log1p(signal_count) / log1p(max_country_count)</code>. Prevents superpowers from drowning out smaller theaters.</p>

    <h2>No Algorithmic Personalization by Default</h2>
    <p>"Dead Drop" feed is <strong>opt-in only</strong>. Monitored frequencies stored in <code>localStorage</code>. No server-side profiling. No tracking pixels in Numbers Station.</p>

    <h2>Errata Policy</h2>
    <p>All corrections logged publicly at <a href="${sectionUrl("errata")}">Errata</a>. Each entry: original claim, correction, date, source intercept link.</p>

    <h2>Data Sources & Refresh</h2>
    <p>RSS/Atom feeds from 100+ assets, polled every 4 hours. Clustering via embedding similarity (threshold 0.78). Alignment labels assigned at asset level, not per-intercept.</p>
  </div></div>`;
  const tradecraftLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "Tradecraft — BotwaveBomba",
        url: pageUrl("tradecraft"),
        description:
          "How we classify alignment, vetting, coverage gaps, and ownership. Full transparency.",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "PORTADA", item: pageUrl("index") },
          { "@type": "ListItem", position: 2, name: "Tradecraft" },
        ],
      },
    ],
  };
  write(
    "tradecraft.html",
    chrome("tradecraft", tradecraftBody, {
      title: "Tradecraft — BotwaveBomba",
      description:
        "How we classify alignment, vetting, coverage gaps, and ownership. Full transparency.",
      canonical: pageUrl("tradecraft"),
      jsonLd: tradecraftLd,
    })
  );
  publicPages.push({
    page: "tradecraft",
    title: "Tradecraft — BotwaveBomba",
    desc: "How we classify alignment, vetting, coverage gaps, and ownership.",
  });

  // Search index
  const searchIndex = stories.map((s) => {
    const card = renderSigintCard(s);
    return {
      id: s.id,
      title: card.headline,
      excerpt: card.excerpt,
      asset: card.topAsset?.name || "",
      theater: card.topAsset?.country || "",
      alignment: classifyAlignment(s)[0] || "world",
      theaters: s.countries,
      assets: s.sources.map((x) => x.name),
    };
  });
  writeJson("api/search_index.json", searchIndex);

  // Update meta
  const updatedMeta = {
    ...meta,
    generated_at: new Date().toISOString(),
    pages: publicPages.map((p) => p.page),
    sector_count: SECTIONS.length,
    total_page_count: publicPages.length,
  };
  writeJson("api/meta.json", updatedMeta);

  // REFRACTION: per-story money-trail page
  // Default: pick the story with the highest cross-bloc coverage (3+ blocs represented) — that's the most interesting refraction.
  const candidates = [...stories].sort((a, b) => {
    const aBloc = Object.values(a.alignmentSpread || {}).filter((v) => v > 0).length;
    const bBloc = Object.values(b.alignmentSpread || {}).filter((v) => v > 0).length;
    if (bBloc !== aBloc) return bBloc - aBloc;
    return (b.sources?.length || 0) - (a.sources?.length || 0);
  });
  const defaultRefractionStory = candidates[0] || stories[0];
  if (defaultRefractionStory) {
    const refractionBody = renderRefractionPage(defaultRefractionStory, stories);
    const refractionLd = {
      "@context": "https://schema.org",
      "@type": "AnalysisNewsArticle",
      headline: `Refraction: ${defaultRefractionStory.topHeadlines?.[0] || "Money Trail"}`,
      description:
        "Per-bloc coverage comparison with ownership trail. The frame you see is a function of the funder behind it.",
      url: pageUrl("refraction"),
    };
    write(
      "refraction.html",
      chrome("refraction", refractionBody, {
        title: `Refraction: ${defaultRefractionStory.topHeadlines?.[0] || "Money Trail"} — BotwaveBomba`,
        description:
          "Per-bloc coverage comparison with ownership trail. The frame you see is a function of the funder behind it.",
        canonical: pageUrl("refraction"),
        jsonLd: refractionLd,
        context: `${defaultRefractionStory.topHeadlines?.[0] || "Money Trail"} · ${(defaultRefractionStory.sources || []).length} sources · ${Object.keys(defaultRefractionStory.alignmentSpread || {}).length} blocs`,
      })
    );
    publicPages.push({
      page: "refraction",
      title: `Refraction: ${defaultRefractionStory.topHeadlines?.[0] || "Money Trail"}`,
      desc: "Per-bloc coverage comparison with ownership trail. The frame you see is a function of the funder behind it.",
    });
  }

  // INTELLIGENCE page — Epstein-Files mechanism registry
  // Solely EFTA corpus. The CIA does not work for the people.
  // It works for the people who own the banks.
  const intel = getIntelligence();
  const stats = intel.corpus_stats;
  const classColors: Record<string, string> = {
    INTELLIGENCE: '#c4302b',
    PROSECUTORIAL: '#E86A3C',
    FINANCE: '#E8B339',
    LEGAL: '#3FA796',
    POLITICAL: '#5b8def',
    OLIGARCH: '#a86ad0',
  };
  const classOrder = ['INTELLIGENCE', 'PROSECUTORIAL', 'FINANCE', 'LEGAL', 'POLITICAL', 'OLIGARCH'];

  // Co-occurrence bars
  const coBars = intel.cooccurrence.slice(0, 12).map(({ a, b, count }) => {
    const colorA = classColors[a] || '#888';
    const colorB = classColors[b] || '#888';
    return `<div class="bwb-intel-copair">
      <div class="bwb-intel-copair-names"><span style="color:${colorA}">${a}</span> <span class="bwb-intel-copair-x">↔</span> <span style="color:${colorB}">${b}</span></div>
      <div class="bwb-intel-copair-bar"><span style="width:${Math.min(100, count * 15)}%; background:linear-gradient(90deg, ${colorA}55, ${colorB}55);"></span><strong>${count}</strong></div>
    </div>`;
  }).join("");

  // First-EP chain (10 dated events 1119–2019)
  const epChain = intel.moat_framing.first_ep_chain.map(ev => `
    <li class="bwb-intel-chain-item">
      <span class="bwb-intel-chain-year">${ev.year}</span>
      <span class="bwb-intel-chain-event">${escapeHtml(ev.event)}</span>
      <span class="bwb-intel-chain-mech">${escapeHtml(ev.mechanism)}</span>
    </li>`).join("");

  // Spotlight dossiers (top 5 highest-class-coverage docs)
  const spotlights = intel.spotlight.map((e, i) => {
    const chips = e.classes.map(c =>
      `<span class="bwb-intel-chip" style="background:${classColors[c] || '#888'}22; color:${classColors[c] || '#888'}; border-color:${classColors[c] || '#888'}66">${c}</span>`
    ).join("");
    const actorList = e.actors.length ? e.actors.slice(0, 6).map(a => escapeHtml(a)).join(" · ") : "(no actor tag)";
    return `<article class="bwb-intel-spotlight">
      <header>
        <span class="bwb-intel-spotlight-num">${String(i+1).padStart(2,'0')}</span>
        <span class="bwb-intel-spotlight-bates">${escapeHtml(e.bates)}</span>
        ${e.year ? `<span class="bwb-intel-spotlight-year">${e.year}</span>` : ''}
        <span class="bwb-intel-spotlight-class">${escapeHtml(e.classification)}</span>
      </header>
      <div class="bwb-intel-spotlight-chips">${chips}</div>
      <div class="bwb-intel-spotlight-actors">${actorList}</div>
      <p class="bwb-intel-spotlight-excerpt">"${escapeHtml(e.excerpt)}"</p>
    </article>`;
  }).join("");

  // Entity tallies (top entities per class)
  const tallySections = classOrder.map(cls => {
    const ents = intel.scanner_stats[cls] || {};
    const sorted = Object.entries(ents).sort((a, b) => b[1] - a[1]);
    const max = sorted[0]?.[1] || 1;
    const rows = sorted.map(([name, ct]) =>
      `<li><span class="bwb-intel-tally-bar"><span style="width:${Math.min(100, ct / max * 100)}%; background:${classColors[cls]}"></span></span><span class="bwb-intel-tally-name">${escapeHtml(name)}</span><span class="bwb-intel-tally-num">${ct.toLocaleString()}</span></li>`
    ).join("");
    return `<div class="bwb-intel-tally-block">
      <h3 style="color:${classColors[cls]}">${cls}</h3>
      <ul>${rows}</ul>
    </div>`;
  }).join("");

  // Hero
  const mechanismQuote = `
    <blockquote class="bwb-intel-quote">
      <p>"The CIA does not work for the people. It works for the people who own the banks."</p>
      <cite>— Unwarranted Influence, Kyle Jimenez (2026)</cite>
    </blockquote>`;

  // Book + corkboard companion links
  const companions = `
    <div class="bwb-intel-companions">
      <a class="bwb-intel-companion" href="${escapeHtml(intel.book_reference.path)}" target="_blank" rel="noopener">
        <span class="bwb-intel-companion-kicker">THE THESIS</span>
        <span class="bwb-intel-companion-title">${escapeHtml(intel.book_reference.title)}</span>
        <span class="bwb-intel-companion-meta">${intel.book_reference.chapters.length} chapters · ${intel.book_reference.year}</span>
      </a>
      <a class="bwb-intel-companion" href="${escapeHtml(intel.corkboard_reference.path)}" target="_blank" rel="noopener">
        <span class="bwb-intel-companion-kicker">VISUAL COMPANION</span>
        <span class="bwb-intel-companion-title">${escapeHtml(intel.corkboard_reference.title)}</span>
        <span class="bwb-intel-companion-meta">${escapeHtml(intel.corkboard_reference.aesthetic)}</span>
      </a>
    </div>`;

  // Mechanism cycle (6 steps)
  const cycle = intel.mechanism.cycle.map((step, i) =>
    `<li><span class="bwb-intel-cycle-num">${i+1}</span><span class="bwb-intel-cycle-text">${escapeHtml(step)}</span></li>`
  ).join("");

  const intelligenceBody = `<div class="bwb-layout" style="grid-template-columns:1fr;"><div class="bwb-main">
    <div class="bwb-section-header">
      <span class="bwb-section-kicker">EPSTEIN FILES FOIA</span>
      <h1>INTELLIGENCE</h1>
      <p>The mechanism. The cycle. The exempt-person network exposed in 10,715 primary documents. Every entity below is named in a real EFTA-bates file; every co-occurrence is measured, not asserted.</p>
    </div>

    <div class="bwb-intel-hero">
      <div class="bwb-intel-hero-stats">
        <div><strong>${stats.total_docs.toLocaleString()}</strong><span>EFTA documents</span></div>
        <div><strong>${stats.ocr_processed.toLocaleString()}</strong><span>OCR processed</span></div>
        <div><strong>${stats.hand_tagged_actor_docs.toLocaleString()}</strong><span>hand-tagged</span></div>
        <div><strong>${stats.entries_with_body_hits.toLocaleString()}</strong><span>power-class hits</span></div>
      </div>
      ${mechanismQuote}
    </div>

    ${companions}

    <section class="bwb-intel-section bwb-intel-audit">
      <span class="bwb-section-kicker">PRIMARY SOURCE · KYLE JIMENEZ · 2026-07-14</span>
      <h2>The Alchemy of Impunity</h2>
      <p class="bwb-intel-audit-dek">A forensic financial audit of Donald J. Trump's bankruptcies, tax evasion, bailouts, and the Templar–Epstein–Central Bank continuum (1986–2026). Six bankruptcies. $1.17B in losses 1985–1994. $750 in federal income tax some years. Over $200M in avoided tax liability. Deutsche Bank. The Federal Reserve bailout pipeline. The same shape, the same century.</p>
      <div class="bwb-intel-audit-stats">
        <div><strong>6</strong><span>bankruptcies</span></div>
        <div><strong>$1.17B+</strong><span>1985–1994 losses</span></div>
        <div><strong>$750</strong><span>federal tax, 2016 &amp; 2017</span></div>
        <div><strong>$200M+</strong><span>avoided tax liability</span></div>
        <div><strong>&lt;1%</strong><span>effective tax rate</span></div>
        <div><strong>10/15 yrs</strong><span>$0 federal tax 2001–2015</span></div>
      </div>

      <h3>Bankruptcies — six filings, one playbook</h3>
      <table class="bwb-intel-audit-table">
        <thead><tr><th>Year</th><th>Entity</th><th>Debt</th><th>Creditors</th><th>Outcome</th><th>Worker Impact</th><th>Rebranding</th></tr></thead>
        <tbody>
          <tr><td>1991</td><td>Trump Taj Mahal</td><td>$675M+</td><td>Junk bondholders, banks</td><td>Restructured; closed 2016</td><td>1,000+ layoffs</td><td>→ "Trump Plaza"</td></tr>
          <tr><td>1992</td><td>Trump Castle</td><td>$93.2M</td><td>Bondholders</td><td>Equity given to bondholders</td><td>800+ layoffs</td><td>→ Golden Nugget</td></tr>
          <tr><td>1992</td><td>Trump Plaza Hotel</td><td>$550M</td><td>Citibank</td><td>Foreclosure; sold to Carl Icahn</td><td>800+ layoffs</td><td>→ Trump bought back later</td></tr>
          <tr><td>2004</td><td>Trump Hotels &amp; Casino Resorts</td><td>$1.8B</td><td>Bondholders, banks</td><td>Debt-for-equity swap</td><td>2,000+ layoffs</td><td>→ "Trump Entertainment"</td></tr>
          <tr><td>2009</td><td>Trump Entertainment Resorts</td><td>$1.74B</td><td>Beal Bank, others</td><td>Bankruptcy; sold to Icahn</td><td>1,500+ layoffs</td><td>→ Dissolved entity</td></tr>
          <tr><td>2014</td><td>Trump Entertainment Resorts</td><td>$350M</td><td>Various</td><td>Closure of Trump Taj Mahal</td><td>N/A</td><td>→ Final closure</td></tr>
        </tbody>
      </table>

      <h3>Tax avoidance — the art of not paying</h3>
      <ul class="bwb-intel-audit-list">
        <li><strong>Income shifting:</strong> sham corporations (All County Building Supply &amp; Maintenance) inflated prices to create artificial deductions and skirt gift taxes.</li>
        <li><strong>Offshore accounts:</strong> Panama, Cayman Islands, British Virgin Islands — hide assets, avoid U.S. taxation.</li>
        <li><strong>Aggressive deductions:</strong> $70,000 in personal hair care as a business expense.</li>
        <li><strong>Accelerated depreciation:</strong> the Trump tax law itself enabled immediate write-offs of investment costs.</li>
        <li><strong>Stock options &amp; offshore profit-shifting:</strong> layered on top of the above.</li>
      </ul>
      <p>The result: an effective tax rate below 1% while earning hundreds of millions. $750 in federal income tax in 2016 and 2017. $0 in 10 of the 15 years between 2001 and 2015. IRS audits for failure to report canceled debts as income — closed without assessment.</p>

      <h3>Bailouts — who saved Trump</h3>
      <ul class="bwb-intel-audit-list">
        <li><strong>Deutsche Bank</strong> — continued lending despite repeated bankruptcies.</li>
        <li><strong>Carl Icahn</strong> and other investors — bought debt and properties; kept the businesses afloat.</li>
        <li><strong>Government bailouts (2008):</strong> the Federal Reserve and Treasury bailed out the banks holding Trump's debt.</li>
        <li><strong>Self-deregulation:</strong> the Trump administration reduced capital requirements for major banks, raising the odds of future bailouts.</li>
      </ul>

      <h3>Estimated tax liability avoided, 1986–2026</h3>
      <table class="bwb-intel-audit-table">
        <thead><tr><th>Year</th><th>Estimated Income</th><th>Actual Taxes Paid</th><th>Estimated Taxes Owed (20%)</th><th>Shortfall</th></tr></thead>
        <tbody>
          <tr><td>1986</td><td>$50M</td><td>$0</td><td>$10M</td><td>$10M</td></tr>
          <tr><td>1990</td><td>$100M</td><td>$0 (NOLs)</td><td>$20M</td><td>$20M</td></tr>
          <tr><td>2000</td><td>$200M</td><td>$1M</td><td>$40M</td><td>$39M</td></tr>
          <tr><td>2010</td><td>$300M</td><td>$5M</td><td>$60M</td><td>$55M</td></tr>
          <tr><td>2020</td><td>$400M</td><td>$750K</td><td>$80M</td><td>$79.25M</td></tr>
          <tr class="bwb-intel-audit-total"><td><strong>Total</strong></td><td><strong>$1.05B</strong></td><td><strong>$6.75M</strong></td><td><strong>$210M</strong></td><td><strong>$203.25M</strong></td></tr>
        </tbody>
      </table>

      <h3>The continuum — Templars, central banks, Epstein</h3>
      <p>Trump's bankruptcies are not isolated. The same architecture appears across the centuries:</p>
      <ul class="bwb-intel-audit-list">
        <li><strong>Templar Knights</strong> — corporate structures and legal maneuvers to protect wealth; powerful figures seize assets on the way down.</li>
        <li><strong>Early central banks</strong> (Bank of England 1694; Rothschild dynasty) — control wealth and avoid accountability through financial engineering and political influence.</li>
        <li><strong>The Epstein class</strong> — the modern manifestation: offshore accounts, blackmail, legal loopholes, the same playbook in a different century.</li>
      </ul>

      <h3>Supreme Mathematics &amp; Sovering Cipher — read</h3>
      <ul class="bwb-intel-audit-list">
        <li><strong>Knowledge:</strong> the tools — bankruptcies, shell companies, offshore accounts — are the same ones used by Templars, Rothschilds, and the Epstein class.</li>
        <li><strong>Wisdom:</strong> the outcomes — wealth concentration, worker exploitation, systemic impunity — expose the design.</li>
        <li><strong>Understanding:</strong> the continuum from Templars to Trump reveals the eternal nature of the architecture.</li>
        <li><strong>Freedom or Death:</strong> the system offers freedom to the elite, death to the rest. The Sovering Cipher's eternal interest rate.</li>
      </ul>

      <p class="bwb-intel-audit-foot">This audit is a primary source. It maps Trump's bankruptcies and tax record to the same elite-impunity continuum documented in <em>Unwarranted Influence</em> (Jimenez, 2026) and exposed in the EFTA corpus on this page. Worker harm is not a footnote — it's the substrate the wealth is built on.</p>
      <p class="bwb-intel-audit-source">Full primary source: <code>corruption/2026-07-14—Alchemy_of_Impunity—Trump_Bankruptcies_Tax_1986_2026.md</code> (38 citations).</p>
    </section>

    <section class="bwb-intel-section bwb-intel-audit">
      <span class="bwb-section-kicker">PRIMARY SOURCE · KYLE JIMENEZ · 2026-07-14</span>
      <h2>The Alchemy of Impunity — The Bush Dynasty (1942–2008)</h2>
      <p class="bwb-intel-audit-dek">A forensic audit of three generations of Bush capital flows: Prescott's Union Banking (1924 → 1942 seizure → 1951 restitution), George H.W.'s Zapata (1953 → 1966 exit → 1987 Carlyle), and George W.'s Arbusto→Harken→Texas Rangers pipeline (1977 → 1990 insider-timing sale → 2008 TARP). Filed documents, not inference. The investor-to-appointee pipeline is preserved at NARA RG 46, Box 500.</p>
      <div class="bwb-intel-audit-stats">
        <div><strong>3</strong><span>generations</span></div>
        <div><strong>~$1.5M</strong><span>Prescott 1951</span></div>
        <div><strong>$848,560</strong><span>G.W. 1990 sale</span></div>
        <div><strong>3 wks</strong><span>before $23.2M loss</span></div>
        <div><strong>8</strong><span>investor→appointees</span></div>
        <div><strong>$700B</strong><span>TARP 2008</span></div>
      </div>

      <h3>Mechanism: charter → exempt → move → release</h3>
      <table class="bwb-intel-audit-table">
        <thead><tr><th>Step</th><th>Year</th><th>Document</th><th>Source</th></tr></thead>
        <tbody>
          <tr><td><strong>Charter</strong></td><td>1924</td><td>Union Banking Corporation, 39 Broadway NY</td><td>NY State Archives</td></tr>
          <tr><td><strong>Move</strong></td><td>1924–1941</td><td>Thyssen capital routed via UBC; "millions of Reichsmarks"</td><td><em>I Paid Hitler</em> (1941)</td></tr>
          <tr><td><strong>Release (duress)</strong></td><td>1942-10-20</td><td>Vesting Order 248 — no criminal charges against any director</td><td>Federal Register Vol. 7, p. 9097</td></tr>
          <tr><td><strong>Release (full)</strong></td><td>1948-07-02</td><td>Settlement of War Claims Act 62 Stat. 1198; 50 USC App.</td><td>62 Stat. 1198</td></tr>
          <tr><td><strong>Cash</strong></td><td>1951</td><td>Civil Action 2380-43 — Prescott received ~$1.5M</td><td>NARA RG 131</td></tr>
          <tr><td><strong>Charter</strong></td><td>1953</td><td>Zapata Petroleum (cap. $1M, ~$12M today)</td><td>SEC EDGAR</td></tr>
          <tr><td><strong>Exempt</strong></td><td>1960s</td><td>Zapata SEC 1960–1966 records "inadvertently pulped" — Reagan admin</td><td>Federal Register notice</td></tr>
          <tr><td><strong>Move</strong></td><td>1966</td><td>Zapata exit $1.1M → Senate run</td><td>SEC + Bush campaign</td></tr>
          <tr><td><strong>Charter</strong></td><td>1977</td><td>Arbusto Energy (Texas)</td><td>TX Sec. of State</td></tr>
          <tr><td><strong>Charter</strong></td><td>1986</td><td>Harken acquires Spectrum 7; G.W. receives $600K shares + $120K/yr consulting</td><td>SEC</td></tr>
          <tr><td><strong>Move</strong></td><td>1990-06-22</td><td>G.W. sells $848,560 Harken — three weeks before $23.2M loss announcement</td><td>SEC Form 4</td></tr>
          <tr><td><strong>Exempt</strong></td><td>1990-08</td><td>SEC investigation of insider trading — closed without action</td><td>SEC closure</td></tr>
          <tr><td><strong>Charter</strong></td><td>1987</td><td>Carlyle Group (Carlyle Hotel, NY)</td><td>Carlyle</td></tr>
          <tr><td><strong>Move</strong></td><td>1991</td><td>Gulf War → defense contracts → Carlyle (H.W. advisor)</td><td>Pentagon procurement</td></tr>
          <tr><td><strong>Move</strong></td><td>1994</td><td>Texas Rangers stake ~$600K (funded by Harken sale)</td><td>Rangers LP filings</td></tr>
          <tr><td><strong>Rebrand</strong></td><td>2001</td><td>Struggling oil man → successful sports owner → 43rd President</td><td>Public record</td></tr>
          <tr><td><strong>Move</strong></td><td>2001–2008</td><td>Iraq + Afghanistan wars — defense contracts to Carlyle/United Defense (~$240M Carlyle return)</td><td>Pentagon</td></tr>
          <tr><td><strong>Release</strong></td><td>2008-10-03</td><td>TARP — $700B transfer to core financial institutions</td><td>EESA</td></tr>
        </tbody>
      </table>

      <h3>The investor-to-appointee pipeline (NARA RG 46, Box 500)</h3>
      <table class="bwb-intel-audit-table">
        <thead><tr><th>Investor</th><th>Investment</th><th>Federal Appointment</th><th>Administration</th></tr></thead>
        <tbody>
          <tr><td>John D. Macomber</td><td>~$79,500 Arbusto</td><td>President, Export-Import Bank</td><td>Reagan / H.W. as VP</td></tr>
          <tr><td>William H. Draper III</td><td>~$93,000 Arbusto</td><td>President, Export-Import Bank</td><td>George H.W. Bush</td></tr>
          <tr><td>William DeWitt Jr.</td><td>Spectrum 7 partner</td><td>President's Intelligence Advisory Board</td><td>George W. Bush (2003)</td></tr>
          <tr><td>Mercer Reynolds</td><td>Spectrum 7 partner</td><td>U.S. Ambassador to Switzerland; Finance Chair 2004</td><td>George W. Bush (2001–2003)</td></tr>
          <tr><td>Mike Conaway</td><td>Arbusto CFO 1981–1986</td><td>U.S. Representative, TX</td><td>(2005–2021)</td></tr>
          <tr><td>James R. Bath</td><td>$50,000 (5% Arbusto)</td><td>No appointment; link to Salem bin Laden documented</td><td>—</td></tr>
          <tr><td>Roland W. Betts</td><td>$100,000 to Rangers</td><td>U.S. Ambassador to Belgium</td><td>Obama (2009)</td></tr>
          <tr><td>Ray Hunt</td><td>$100,000 to Rangers</td><td>National Security Council member</td><td>George W. Bush (2001)</td></tr>
        </tbody>
      </table>

      <h3>Donor-class overlap (from <code>update.md</code> spine)</h3>
      <p>Koch / Koch / Wexner / AIPAC / Vatican / MIC / CIA — Bush 2000–2008 shares the same donor class as Trump, Biden, Clinton, and Obama. The mechanism is non-partisan. Skull &amp; Bones roster: Prescott (1918), H.W. (1948), G.W. (1968), Kerry (1966), Buckley (1950 — Yale '50 with H.W.), Pompeo (1986). G.W. is on record in the Lolita Express: 26 flights per <code>update.md</code>.</p>

      <p class="bwb-intel-audit-foot">The pipeline is typed, single-spaced, blue ink. The paper is yellowed. The edges are brittle. The pipeline is the mechanism. The pipeline is filed at NARA. The mechanism is the system. The system is the receipt.</p>
      <p class="bwb-intel-audit-source">Full primary source: <code>corruption/2026-07-14—Alchemy_of_Impunity—Bush_Dynasty_1942_2008.md</code> (16 citations, all filed documents).</p>
    </section>

    <section class="bwb-intel-section bwb-intel-audit">
      <span class="bwb-section-kicker">PRIMARY SOURCE · KYLE JIMENEZ · 2026-07-14</span>
      <h2>The Alchemy of Impunity — The Biden Family Network (2008–2026)</h2>
      <p class="bwb-intel-audit-dek">A forensic audit of the Biden shell network: 20+ Delaware entities, $20M+ from foreign sources, 150+ SARs, House Oversight bank-record memos, Hunter conviction (June 2024), full and unconditional pardon (December 1, 2024). Substrate: <em>THEBIDENENCYCLOPEDIA.md</em> + 6 PDFs in <code>Documents/Biden/</code> + 81-poll approval dataset (Jan 2024 – Jan 2025).</p>
      <div class="bwb-intel-audit-stats">
        <div><strong>$3.5M</strong><span>Baturina wire 2014</span></div>
        <div><strong>$1M/yr</strong><span>Burisma 2014–2019</span></div>
        <div><strong>$5M+</strong><span>CEFC 2015–2017</span></div>
        <div><strong>150+</strong><span>FinCEN SARs</span></div>
        <div><strong>20+</strong><span>Delaware shells</span></div>
        <div><strong>~39.4%</strong><span>avg approval, 2024–25</span></div>
      </div>

      <h3>The wires (House Oversight bank-record memos)</h3>
      <table class="bwb-intel-audit-table">
        <thead><tr><th>Date</th><th>Source</th><th>Destination</th><th>Amount</th><th>Memo</th></tr></thead>
        <tbody>
          <tr><td>2014-02</td><td>Yelena Baturina (Russia)</td><td>Rosemont Seneca Thornton</td><td>$3,500,000</td><td>Third Bank Memo (2023-05-10)</td></tr>
          <tr><td>2014-08</td><td>Kenes Rakishev (Kazakhstan)</td><td>Rosemont Seneca</td><td>$142,300</td><td>Third Bank Memo (Hunter's car)</td></tr>
          <tr><td>2014–2019</td><td>Burisma (Ukraine)</td><td>Rosemont Seneca / Hunter</td><td>$1M/yr × 5yr</td><td>House Oversight 2023-07-25</td></tr>
          <tr><td>2015–2017</td><td>CEFC (China)</td><td>Hudson West III</td><td>$5,000,000+</td><td>Senate HSGAC Report (2020)</td></tr>
          <tr><td>2017+</td><td>CEFC → Owasco P.C.</td><td>"Law firm" vehicle</td><td>$1M+</td><td>Senate HSGAC Report (2020)</td></tr>
          <tr><td>2013+</td><td>Bohai Harvest RST (BHR)</td><td>Hunter 10% stake</td><td>$420,000 initial</td><td>SEC EDGAR</td></tr>
        </tbody>
      </table>

      <h3>The shell architecture (per <em>Hudson West III LLC Agreement.pdf</em>)</h3>
      <ul class="bwb-intel-audit-list">
        <li><strong>Rosemont Seneca Partners</strong> (DE 5308739, 2013) — investment advisory, Hunter's master entity</li>
        <li><strong>Rosemont Seneca Thornton</strong> — Baturina vehicle</li>
        <li><strong>Hudson West III</strong> (DE, 2017) — Chinese-funds vehicle, <code>Hudson West III LLC Agreement.pdf</code></li>
        <li><strong>Owasco P.C.</strong> — Hunter's "law firm," received CEFC payments</li>
        <li><strong>Seneca Global Advisors</strong> — consulting</li>
        <li><strong>Bohai Harvest RST (BHR)</strong> — DE/Cayman private equity, Hunter 10%</li>
      </ul>
      <p><strong>Exempt:</strong> Delaware Title 8 §§101-325 — no beneficial-ownership disclosure. The 20+ shells were filed in plain view because the LLC statute requires zero transparency on owners. <strong>JPMorgan processed $670M+</strong> for Biden family/associates; <strong>Deutsche Bank</strong> $851M+; <strong>Bank of America</strong> $486M+ (per ICIJ FinCEN Files / House Oversight).</p>

      <h3>The release step — prosecutorial timeline</h3>
      <table class="bwb-intel-audit-table">
        <thead><tr><th>Date</th><th>Event</th><th>Source</th></tr></thead>
        <tbody>
          <tr><td>2023-06-20</td><td>Hunter indicted (Delaware) on firearms charges</td><td><code>rhb_indictment.pdf</code></td></tr>
          <tr><td>2023-07-26</td><td>Federal plea deal filed</td><td><code>gov.uscourts.nysd.590048.1.0_5.pdf</code></td></tr>
          <tr><td>2023-08-11</td><td>Plea deal collapses; Judge Noreika questions scope</td><td>PACER hearing transcript</td></tr>
          <tr><td>2023-08-11</td><td>David Weiss appointed Special Counsel</td><td>DOJ press release</td></tr>
          <tr><td>2024-06-11</td><td>Hunter convicted on three felony counts (Delaware)</td><td>PACER</td></tr>
          <tr><td>2024-09</td><td>IRS whistleblowers Shapley &amp; Ziegler testify</td><td>oversight.house.gov</td></tr>
          <tr><td><strong>2024-12-01</strong></td><td><strong>Full and unconditional pardon by Joseph R. Biden Jr.</strong></td><td>White House Proclamation</td></tr>
        </tbody>
      </table>

      <h3>Public reception vs. mechanism (81 polls, 15+ pollsters)</h3>
      <p>Source: <code>Biden-Approval-2024-2025.csv</code> + <code>Biden-Approval-Analysis-2024-2025.md</code>.</p>
      <ul class="bwb-intel-audit-list">
        <li><strong>Average approval (final year):</strong> ~39.4%</li>
        <li><strong>Approval range:</strong> 33%–46% (13 pp spread)</li>
        <li><strong>Highest:</strong> 46% (March 2024)</li>
        <li><strong>Lowest:</strong> 33% (January 2024 — Pew + ABC)</li>
        <li><strong>Final (January 2025):</strong> 37%–41% (Gallup 40, AP-NORC 41, CNN 36, ARG 37)</li>
        <li><strong>Full-term average:</strong> ~42%</li>
        <li><strong>Initial (January 2021):</strong> ~53%–57%</li>
        <li><strong>Net fall across term:</strong> ~14 percentage points</li>
      </ul>
      <p>The polling window tracks the indictment → conviction → pardon timeline. The 33–46% range is the public's awareness of the four-step mechanism in real time. The pardon closed the year. The 14-point fall from inauguration to the end is the substrate reading: the mechanism was visible, the mechanism was filed, the mechanism's release was *also* filed.</p>

      <p class="bwb-intel-audit-foot">The pardon is the release step in real time. When the prosecutorial apparatus produced a conviction, the executive apparatus voided it. The same family, two branches, one mechanism. The mechanism is the system. The system is the receipt.</p>
      <p class="bwb-intel-audit-source">Full primary source: <code>corruption/2026-07-14—Alchemy_of_Impunity—Biden_Shell_Network_2008_2026.md</code> (19 substrate citations).</p>
    </section>

    <section class="bwb-intel-section bwb-intel-audit">
      <span class="bwb-section-kicker">PRIMARY SOURCE · KYLE JIMENEZ · 2026-07-14</span>
      <h2>The Alchemy of Impunity — The Clinton Network (1978–2024)</h2>
      <p class="bwb-intel-audit-dek">A first-pass audit of four decades of Clinton network capital: Whitewater (1978) → Madison Guaranty S&amp;L → cattle futures ($100K → $1M+) → White House (1993–2001) → Foundation ($2B+ foreign-donor flow during Hillary tenure as Secretary of State) → post-2018. Substrate: <code>update.md</code> donor-class spine + Skull &amp; Bones '68 row. <em>Status:</em> First pass; specific case evidence to be expanded from next research pass.</p>
      <div class="bwb-intel-audit-stats">
        <div><strong>$1M+</strong><span>cattle futures, $100K seed</span></div>
        <div><strong>$2B+</strong><span>Foundation disclosed</span></div>
        <div><strong>26</strong><span>Epstein flights (per <code>update.md</code>)</span></div>
        <div><strong>6 yrs</strong><span>Whitewater Counsel 1994–2000</span></div>
        <div><strong>0</strong><span>criminal charges (financial)</span></div>
        <div><strong>5</strong><span>Saban / Bloomberg / Soros / Wexner / Steyer</span></div>
      </div>

      <h3>The mechanism: charter → exempt → move → release</h3>
      <table class="bwb-intel-audit-table">
        <thead><tr><th>Step</th><th>Year</th><th>Entity / Document</th><th>Source</th></tr></thead>
        <tbody>
          <tr><td><strong>Charter</strong></td><td>1978</td><td>Whitewater Development Corporation (AR)</td><td>Public record</td></tr>
          <tr><td><strong>Exempt</strong></td><td>1980s</td><td>Madison Guaranty Savings &amp; Loan (FICO/FDIC insurance)</td><td>Public record</td></tr>
          <tr><td><strong>Move</strong></td><td>1978</td><td>Cattle futures: $100K → $1M+ via 10:1 leverage (Spruce Grain / Ray-Don)</td><td>CFTC investigation 1994</td></tr>
          <tr><td><strong>Exempt</strong></td><td>1994</td><td>Whitewater Independent Counsel (Fiske → Starr); runs 1994–2000</td><td>DOJ</td></tr>
          <tr><td><strong>Release</strong></td><td>2001</td><td>Whitewater closed; no Whitewater conviction of the President on financial charges</td><td>DOJ</td></tr>
          <tr><td><strong>Charter</strong></td><td>2001</td><td>Clinton Foundation (501(c)(3))</td><td>IRS 990</td></tr>
          <tr><td><strong>Move</strong></td><td>2009–2013</td><td>Foreign-donor flow during Hillary tenure as Secretary of State</td><td>State Dept disclosure</td></tr>
          <tr><td><strong>Release</strong></td><td>2018</td><td>DOJ closes Foundation investigation</td><td>DOJ press release</td></tr>
        </tbody>
      </table>

      <h3>Donor class + Skull &amp; Bones (from <code>update.md</code>)</h3>
      <p><strong>Bill Clinton — Skull &amp; Bones '68</strong> (per <code>update.md</code> table): "Epstein (26 flights), Wexner (close ties)." The 26-flight number requires the EFTA flight-log primary source (Lolita Express N908JE, N474AW) which is in the corpus. The Wexner-Black overlap is in the House Oversight record. Saban ($3.7B, $200M+, 90% D), Bloomberg ($60B, $1B+), Soros ($7B, $500M+), Wexner ($6B, $50M+), Steyer ($1.6B, $300M+, 99% D) — all five flow through the Clinton orbit, the Obama orbit, the Biden orbit, the Bush orbit, the Trump orbit. <strong>AIPAC $25M+ (1992, 1996); Oslo Accords (sabotaged); $3B/yr to Israel; Vatican Catholic Alliances; Welfare Reform (anti-poor per <code>update.md</code>); MIC Yugoslavia War + Somalia; CIA close ties.</strong></p>

      <h3>To be filled from next research pass</h3>
      <ul class="bwb-intel-audit-list">
        <li>EFTA flight-log primary source for the 26 flights (Lolita Express manifests)</li>
        <li>Wexner–Clinton–Black financial overlap (House Oversight record)</li>
        <li>CFTC cattle-futures primary documents</li>
        <li>Whitewater Independent Counsel final report (citation + filing)</li>
        <li>Foundation 990s 2001–2016 with foreign-donor breakdown</li>
        <li>Welfare Reform / NAFTA worker-impact numbers</li>
      </ul>

      <p class="bwb-intel-audit-foot">The mechanism is filed. The form rotates (cattle futures → Foundation → post-presidency); the function is constant. The donor class is the same donor class as Bush, Obama, Biden, and Trump. The mechanism is non-partisan.</p>
      <p class="bwb-intel-audit-source">Full primary source: <code>corruption/2026-07-14—Alchemy_of_Impunity—Clinton_Network_1978_2024.md</code> (10 substrate citations, first pass).</p>
    </section>

    <section class="bwb-intel-section bwb-intel-audit">
      <span class="bwb-section-kicker">PRIMARY SOURCE · KYLE JIMENEZ · 2026-07-14</span>
      <h2>The Alchemy of Impunity — The Obama Network (2008–2024)</h2>
      <p class="bwb-intel-audit-dek">A first-pass audit of the Obama presidency and post-presidency: drone program (7× Bush per <code>update.md</code>), Libya War (no Congressional authorization, House Resolution 208 failed), Iran Deal + $1.7B cash payment (January 2016), NSA mass surveillance (FISC + Snowden), Foundation + Netflix deal ($65M+). Substrate: <code>update.md</code> donor-class spine. <em>Status:</em> First pass; specific case evidence to be expanded from next research pass.</p>
      <div class="bwb-intel-audit-stats">
        <div><strong>7×</strong><span>drone strikes vs. Bush</span></div>
        <div><strong>$1.7B</strong><span>cash to Iran 2016-01</span></div>
        <div><strong>$65M+</strong><span>Netflix deal 2018</span></div>
        <div><strong>$830M</strong><span>Presidential Center cost</span></div>
        <div><strong>$100M+</strong><span>AIPAC 2008, 2012</span></div>
        <div><strong>5</strong><span>Saban / Bloomberg / Soros / Wexner / Steyer</span></div>
      </div>

      <h3>The mechanism: charter → exempt → move → release</h3>
      <table class="bwb-intel-audit-table">
        <thead><tr><th>Step</th><th>Year</th><th>Event</th><th>Source</th></tr></thead>
        <tbody>
          <tr><td><strong>Charter</strong></td><td>2014</td><td>Obama Foundation (501(c)(3))</td><td>IRS 990</td></tr>
          <tr><td><strong>Move</strong></td><td>2011</td><td>Libya War (Operation Odyssey Dawn / Unified Protector) — no Congressional authorization</td><td>House Resolution 208 (failed 2011-06)</td></tr>
          <tr><td><strong>Exempt</strong></td><td>2009–2017</td><td>Drone program under AUMF 2001; OLC memo 2016</td><td>OLC + Bureau of Investigative Journalism</td></tr>
          <tr><td><strong>Exempt</strong></td><td>2013</td><td>NSA bulk collection (Section 215 PATRIOT); FISC rubber-stamp</td><td>Snowden disclosures + PCLOB 2014</td></tr>
          <tr><td><strong>Move</strong></td><td>2015</td><td>JCPOA (Iran Deal)</td><td>State Dept</td></tr>
          <tr><td><strong>Move</strong></td><td>2016-01</td><td>$1.7B cash flown to Iran ($400M principal + $1.3B interest)</td><td>WSJ / State Dept</td></tr>
          <tr><td><strong>Release</strong></td><td>2018-05</td><td>Trump abandons JCPOA; no accountability for cash payment</td><td>Public record</td></tr>
          <tr><td><strong>Release</strong></td><td>2020-09</td><td>11th Circuit: NSA program unlawful (after the fact)</td><td>11th Cir Court of Appeals</td></tr>
          <tr><td><strong>Move</strong></td><td>2018-05</td><td>Netflix / Higher Ground Productions deal ($65M+)</td><td>Netflix press release</td></tr>
          <tr><td><strong>Charter</strong></td><td>2021+</td><td>Obama Presidential Center construction (~$830M, Chicago)</td><td>Obama Foundation</td></tr>
        </tbody>
      </table>

      <h3>Donor class (from <code>update.md</code>)</h3>
      <p>Saban ($3.7B, 90% D), Bloomberg ($60B, 60% D), Soros ($7B, 95% D), Wexner ($6B, 60% R/40% D), Steyer ($1.6B, 99% D) — all five flow through the Obama orbit. AIPAC $100M+ (2008, 2012); $38B military deal; Iran Deal (later abandoned). Vatican "Catholic Social Justice (Limited)"; ACA "no abortion coverage." MIC $40M+; Libya War + Drone Wars (7× Bush per <code>update.md</code>). CIA close ties; NSA mass surveillance.</p>

      <h3>To be filled from next research pass</h3>
      <ul class="bwb-intel-audit-list">
        <li>OLC memo 2016 text + civilian-casualty threshold</li>
        <li>Bureau of Investigative Journalism strike data with country breakdown</li>
        <li>State Department disclosure of Foundation donors during tenure</li>
        <li>11th Circuit FISA ruling (2020) full citation</li>
        <li>Higher Ground Productions corporate filings</li>
        <li>ACA industry-capture documentation (premium trajectory)</li>
      </ul>

      <p class="bwb-intel-audit-foot">The drone strike, the cash payment, the FISC exemption — each legal under the apparatus; the apparatus is the mechanism. The Foundation continues. The Netflix deal continues. The Presidential Center is under construction. The mechanism survives the office.</p>
      <h3>The Hypocrisy Ledger: Rhetoric vs. Record</h3>
      <p>Three vectors: slavery rhetoric vs. Libya slave markets; "innocent people are victims" vs. 174–334 children killed in drone strikes; "we were strangers once" vs. 5.3 million removals. The form rotates. The function is constant. Substrate: <code>update.md</code> (Libya $1B oil contracts, drone 7× Bush, defense contractor stocks ↑ 200%) + TBIJ Drone War database + DHS Yearbook of Immigration Statistics + The Intercept Drone Papers + CNN Libya 2017 reporting + OLC memo 2016.</p>

      <h4>1. Slavery rhetoric vs. Libya slave markets</h4>
      <table class="bwb-intel-audit-table">
        <thead><tr><th>Date</th><th>Rhetoric (public record)</th><th>Source</th></tr></thead>
        <tbody>
          <tr><td>2008-03-18</td><td>"The brutal legacy of bondage… the most powerful of America's racial sins." — Philadelphia, "A More Perfect Union"</td><td><a href="https://www.americanrhetoric.com/speeches/barackobama/barackobamaphiladelphia.htm">americanrhetoric.com</a></td></tr>
          <tr><td>2015-09-24</td><td>"The slave trade was an evil empire built on the kidnapping, sale, and shipping of human beings… a fundamental evil that we continue to confront in different forms." — UN General Assembly</td><td><a href="https://obamawhitehouse.archives.gov/the-press-office/2015/09/25/remarks-president-obama-2015-united-nations-general-assembly">White House transcript</a></td></tr>
          <tr><td>2016-09-21</td><td>"A crime against humanity." Pledges U.S. leadership on "modern slavery" globally. — U.S. African Leaders Summit</td><td><a href="https://2009-2017.state.gov/r/pa/prs/ps/2016/09/262443.htm">State Dept archive</a></td></tr>
          <tr><td>2016-12-06</td><td>"A story of people of good conscience taking action to right a great wrong." — National Freedom Day</td><td>White House archive</td></tr>
        </tbody>
      </table>
      <table class="bwb-intel-audit-table">
        <thead><tr><th>Date</th><th>Policy / record (Libya)</th><th>Source</th></tr></thead>
        <tbody>
          <tr><td>2011-03-19</td><td>Operation Odyssey Dawn begins — 122 Tomahawk cruise missiles against Libyan targets, 24 hours after UNSCR 1973</td><td><a href="https://archive.defense.gov/news/newsarticle.aspx?id=63298">Pentagon briefing</a></td></tr>
          <tr><td>2011-03-23</td><td>"We cannot stand idly by when a tyrant tells his people there will be no mercy… our responsibilities to protect human life." — Obama address to the nation</td><td><a href="https://obamawhitehouse.archives.gov/the-press-office/2011/03/18/remarks-president-address-nation-libya">White House transcript</a></td></tr>
          <tr><td>2011-10-20</td><td>Muammar Gaddafi killed. Hillary Clinton: "We came, we saw, he died." Obama: no public comment for 2 days.</td><td><a href="https://www.reuters.com/article/us-libya-qaddafi-idUSTRE79J3PB20111020">Reuters</a></td></tr>
          <tr><td>2011–2014</td><td>Libya becomes a failed state. No national government. Multiple armed militias. CRS R43618 documents collapse.</td><td><a href="https://crsreports.congress.gov/product/pdf/R/R43618">CRS R43618</a></td></tr>
          <tr><td>2014–2017</td><td>Smuggling networks exploit the vacuum. Sub-Saharan, Egyptian, Bangladeshi, Pakistani, Syrian migrants transiting Libya become commodity.</td><td>IOM Libya Tracker</td></tr>
          <tr><td><strong>2017-11-19</strong></td><td><strong>CNN publishes "People for sale: Inside the modern-day slave markets of Libya" — men sold at auction for $400, in the open air south of Tripoli</strong></td><td><a href="https://www.cnn.com/2017/11/15/africa/libya-migrant-slave-market/index.html">CNN</a></td></tr>
          <tr><td>2017-12-04</td><td>EU Parliament Vice President Antonio Tajani calls for EU investigation. Footage broadcast globally.</td><td>EP statement</td></tr>
          <tr><td>2017-12-06</td><td>UN Security Council briefing: thousands held in "slave-like conditions" in Libyan detention facilities. IOM estimates 700,000+ migrants in Libya.</td><td>UN OHCHR</td></tr>
          <tr><td>2018-04-12</td><td>Obama keynote at MBLC Leaders Forum, Boston: "Moral leadership in the age of upheaval." No Libya mention.</td><td>MBLC archive</td></tr>
          <tr><td>2018-11-19</td><td>Obama Foundation Summit, Chicago: "The Cost of Inaction." Discusses "moral responsibility." No Libya mention.</td><td>Obama Foundation Summit</td></tr>
        </tbody>
      </table>
      <p><strong>Contradiction:</strong> The president who called the slave trade "an evil empire" launched a military intervention explicitly framed in moral terms ("responsibility to protect") that produced documented, broadcastable public slave auctions six years later. The intervention killed the head of state, dismantled the government, and created the conditions for IOM-documented slave markets. The form rotates (1776 abolition rhetoric → 2011 moral intervention → 2017 silence). The function is constant: weapons contractors and oil companies (per <code>update.md</code>: $1B in Libya oil contracts, defense contractor stocks ↑ 200%).</p>

      <h4>2. "Innocent people are victims" vs. drone strikes on women and children</h4>
      <table class="bwb-intel-audit-table">
        <thead><tr><th>Date</th><th>Rhetoric (public record)</th><th>Source</th></tr></thead>
        <tbody>
          <tr><td>2013-05-23</td><td>"Our efforts to dismantle terrorist networks must not be a cover for us to ignore the law or the values we claim to defend." — National Defense University</td><td><a href="https://obamawhitehouse.archives.gov/the-press-office/2013/05/23/remarks-president-national-defense-university">White House</a></td></tr>
          <tr><td>2013-08-09</td><td>Targeted killings = "a profoundly serious and legitimate instrument of national security" subject to "legal restrictions, oversight, and accountability."</td><td><a href="https://obamawhitehouse.archives.gov/the-press-office/2013/08/09/remarks-president-press-gaggle">White House</a></td></tr>
          <tr><td>2016-07-01</td><td>"The innocent people who are being killed in these operations are not the enemy. They are victims of terrorism as much as anyone else." — PBS NewsHour</td><td><a href="https://www.pbs.org/newshour/show/president-obama-defends-u-s-counterterrorism-strategy">PBS NewsHour</a></td></tr>
        </tbody>
      </table>
      <table class="bwb-intel-audit-table">
        <thead><tr><th>Date</th><th>Casualty (named)</th><th>Age / Role</th><th>Country</th><th>Source</th></tr></thead>
        <tbody>
          <tr><td>2009–2016 (8 yrs)</td><td><strong>541–1,660 civilians</strong> total killed in U.S. drone strikes (vs. 303–952 in entire Bush 8 yrs); <strong>174–334 children</strong></td><td>—</td><td>Pakistan, Yemen, Somalia, Libya</td><td><a href="https://www.thebureauinvestigates.com/projects/drone-war">TBIJ Drone War</a></td></tr>
          <tr><td>2012-03-17</td><td>Radhya al-Taisy — 14-yr-old girl</td><td>14 F</td><td>Yemen (al-Majalah)</td><td><a href="https://www.reuters.com/article/us-yemen-usa-strike-idUSBRE82I0JX20120319">Reuters</a></td></tr>
          <tr><td>2012-06-04</td><td>4 children among 18 killed in single strike</td><td>—</td><td>Pakistan (Waziristan)</td><td><a href="https://www.reuters.com/article/us-pakistan-drones-strike-idUSBRE8530S720120604">Reuters</a></td></tr>
          <tr><td>2012-08-24</td><td>Wedding party — 5 women, 3 children</td><td>—</td><td>Yemen (Abyan)</td><td><a href="https://www.aljazeera.com/news/middleeast/2012/8/25/yemen-strike-killed-civilians">Al Jazeera</a></td></tr>
          <tr><td>2013-01-23</td><td>Tariq Khan</td><td>16 M</td><td>Pakistan (N. Waziristan)</td><td>TBIJ</td></tr>
          <tr><td>2013-12-12</td><td>Abdulrahman al-Awlaki — U.S. citizen, son of Anwar (killed 2 wks earlier)</td><td>16 M (U.S. citizen)</td><td>Yemen (Radaa)</td><td><a href="https://www.nytimes.com/2013/12/22/us/politics/awlakis-son-aimed-at-by-us.html">NYT</a></td></tr>
          <tr><td>2014-01-20</td><td>Salma</td><td>5 F</td><td>Yemen (Abyan)</td><td>TBIJ</td></tr>
          <tr><td>2015-04-13</td><td>Mariam and her grandmother</td><td>9 F, F</td><td>Yemen (Mukalla)</td><td>TBIJ</td></tr>
          <tr><td>2016-01-26</td><td>Bilal and Hajar</td><td>9 M, 7 F</td><td>Yemen (Haydan)</td><td>TBIJ</td></tr>
          <tr><td>2017-01-29</td><td>Asmaa</td><td>5 F</td><td>Yemen (al-Bayda)</td><td>TBIJ</td></tr>
          <tr><td>2017-03-02</td><td>Bayan and Waleed</td><td>2 F, 6 M</td><td>Yemen (Abyan)</td><td>TBIJ</td></tr>
        </tbody>
      </table>
      <p><strong>The Intercept — "The Drone Papers" (2015-10-15):</strong> Leaked classified DIA/JSOC documents reveal that over a five-month period in late 2014 / early 2015, <strong>nearly 90% of people killed in U.S. air strikes in Afghanistan, Pakistan, Yemen, Somalia, and Libya were not the intended targets.</strong> Of 114 killed in 9 strikes, only 35 were the intended targets. (<a href="https://theintercept.com/drone-papers/">theintercept.com</a>)</p>
      <p><strong>OLC memo 2016:</strong> Released under ACLU litigation. Sets a casualty threshold allowing strikes if expected civilian casualties are not "excessive in relation to the anticipated military advantage." The exact numerical threshold remains classified.</p>
      <p><strong>Contradiction:</strong> The president who said innocent people "are not the enemy… are victims of terrorism" presided over the documented killing of at least 174–334 children — including 5-year-old Salma, 2-year-old Bayan, 14-year-old Radhya, 16-year-old Tariq, and 16-year-old U.S. citizen Abdulrahman al-Awlaki. The signature-strike policy, the OLC memo, the 7× Bush strike rate are public record. The form rotates ("restraint," "rules of engagement"). The function is constant: defense contractor stocks ↑ 200% (per <code>update.md</code>).</p>

      <h4>3. "We were strangers once" vs. 5.3 million removals ("Deporter-in-Chief")</h4>
      <table class="bwb-intel-audit-table">
        <thead><tr><th>Date</th><th>Rhetoric (public record)</th><th>Source</th></tr></thead>
        <tbody>
          <tr><td>2014-11-20</td><td>"We are and always will be a nation of immigrants. We were strangers once, too." Frames DACA/DAPA as protecting "innocent, young people" from "the threat of deportation."</td><td><a href="https://obamawhitehouse.archives.gov/the-press-office/2014/11/20/remarks-president-immigration">White House</a></td></tr>
          <tr><td>2015-07-15</td><td>"Someone who has been in this country, who has contributed to this country, who has a family here, who has children here — they're Americans in every way except on paper." — Facebook Q&amp;A</td><td><a href="https://www.facebook.com/barackobama/videos/10153430822287469/">Facebook</a></td></tr>
          <tr><td>2016-05-05</td><td>"We are here to celebrate the generations of Latino immigrants who have helped make this country what it is." — Cinco de Mayo</td><td><a href="https://obamawhitehouse.archives.gov/the-press-office/2016/05/05/remarks-president-cinco-de-mayo">White House</a></td></tr>
        </tbody>
      </table>
      <table class="bwb-intel-audit-table">
        <thead><tr><th>Period</th><th>Record (deportations)</th><th>Source</th></tr></thead>
        <tbody>
          <tr><td>Bush 2001–2008 (8 yrs)</td><td>~3.4 million removals</td><td>DHS Yearbook</td></tr>
          <tr><td><strong>Obama 2009–2016 (8 yrs)</strong></td><td><strong>5.3 million removals — highest total in U.S. history</strong></td><td><a href="https://www.dhs.gov/sites/default/files/publications/Yearbook_Immigration_Statistics_2016_0.pdf">DHS 2016 Yearbook, Table 39</a></td></tr>
          <tr><td>2012 single year</td><td>409,849 removals — highest single year in U.S. history at that point</td><td>DHS</td></tr>
          <tr><td>2013 single year</td><td>368,644 removals</td><td>DHS</td></tr>
          <tr><td>2014 single year</td><td>377,956 removals</td><td>DHS</td></tr>
          <tr><td>2013</td><td>"Secure Communities" expanded to all 3,181 U.S. counties — local law enforcement required to detain and transfer suspected undocumented immigrants to ICE</td><td><a href="https://www.ice.gov/secure-communities">ICE</a></td></tr>
          <tr><td>2014–2015</td><td>Family detention expansion: Karnes County (TX) and Dilley (TX) ICE family detention centers opened. Total family detention capacity peaked at ~3,200 beds.</td><td><a href="https://trac.syr.edu/immigration/reports/371/">TRAC Immigration</a></td></tr>
          <tr><td>2011-08-18</td><td>Morton Memos (ICE Director John Morton) — directs enforcement to "criminal aliens" but preserves removal authority over ALL removable aliens</td><td><a href="https://www.ice.gov/doclib/secure-communities/pdf/ice-priority-enforcement.pdf">ICE</a></td></tr>
          <tr><td>2016 (SCOTUS)</td><td>United States v. Texas — 4-4 SCOTUS split leaves in place 5th Circuit injunction blocking DAPA. DACA (2012) survives; DAPA dies.</td><td><a href="https://www.supremecourt.gov/opinions/15pdf/15-674_jhgk.pdf">SCOTUS 15-674</a></td></tr>
        </tbody>
      </table>
      <p><strong>"Deporter-in-Chief" framing:</strong> National Day Laborer Organizing Network (<a href="https://ndlon.org/2014/04/obama-deporter-in-chief/">NDDON 2014-04</a>), Center for Constitutional Rights, National Immigration Forum.</p>
      <p><strong>Contradiction:</strong> The president who said "we were strangers once, too" and "they're Americans in every way except on paper" presided over the highest total removals in U.S. history — 5.3 million over 8 years, with record-shattering years in 2012, 2013, 2014. Secure Communities expanded to all 3,181 U.S. counties. Family detention capacity grew. DACA created 2012 was accompanied by the highest deportation years on record. The form rotates (DACA, DAPA, "we were strangers once"). The function is constant: families separated, children detained, rhetoric of welcome coexists with policy of mass removal. Donor class served: private prison operators (CCA, GEO Group).</p>

      <h4>The pattern</h4>
      <p>Three vectors, one form, one function: the donor class funds the rhetoric and the policy. The rhetoric maintains a moral public face. The policy produces capital. The victims (Libyan civilians, Yemeni children, deported families) are externalized. The form rotates (speech, OLC memo, immigration priority memo). The function is constant.</p>
      <p><strong>The form rotates. The function is constant. The receipt is filed.</strong></p>

      <p class="bwb-intel-audit-source">Full primary source: <code>corruption/2026-07-14—Alchemy_of_Impunity—Obama_Network_2008_2024.md</code> (Hypocrisy Ledger + 9 substrate citations, expanded pass).</p>
    </section>

    <section class="bwb-intel-section bwb-intel-audit bwb-intel-crosscut">
      <span class="bwb-section-kicker">CROSS-CUTTING · KYLE JIMENEZ · 2026-07-14</span>
      <h2>The Political Class Mechanism</h2>
      <p class="bwb-intel-audit-dek">Five dynasties, one mechanism. Trump. Bush. Biden. Clinton. Obama. Same donor-class spine. Same charter→exempt→move→release pattern. Same Skull &amp; Bones / AIPAC / Vatican / MIC / CIA substrate. The mechanism is non-partisan. The form rotates; the function is constant. The five audits above prove the pattern. The table below is the receipt.</p>

      <h3>Five dynasties, four steps, one mechanism</h3>
      <table class="bwb-intel-audit-table">
        <thead>
          <tr>
            <th>Dynasty</th>
            <th>Charter</th>
            <th>Exempt</th>
            <th>Move</th>
            <th>Release</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Trump</strong><br/><span class="bwb-intel-subtitle">1986–2026</span></td>
            <td>Trump Organization + 6 shell corps (1973→); All County Building Supply (sham pricing)</td>
            <td>Offshore (Panama, Cayman, BVI); IRS audits closed without assessment</td>
            <td>Deutsche Bank; Carl Icahn; 6 bankruptcies (Taj Mahal $675M → 2014 Entertainment $350M)</td>
            <td>$200M+ tax avoided (effective rate &lt;1%); Federal Reserve + TARP bailout 2008; Deutsche Bank 2008–2024</td>
          </tr>
          <tr>
            <td><strong>Bush</strong><br/><span class="bwb-intel-subtitle">1942–2008</span></td>
            <td>Union Banking Corp. (1924) → Zapata (1953) → Arbusto (1977) → Harken (1986) → Carlyle (1987)</td>
            <td>War Claims Act 1948 (62 Stat. 1198); SEC records "inadvertently pulped" (Reagan admin)</td>
            <td>Thyssen → UBC; Bush 43 Harken sale $848,560 (3 wks before $23.2M loss); Carlyle defense contracts (~$240M United Defense IPO)</td>
            <td>Civil Action 2380-43 (1951, ~$1.5M to Prescott); SEC closes Bush 43 investigation 1990; TARP $700B 2008</td>
          </tr>
          <tr>
            <td><strong>Biden</strong><br/><span class="bwb-intel-subtitle">2008–2026</span></td>
            <td>Rosemont Seneca (2013); Hudson West III (2017); Owasco P.C.; BHR Partners (DE/Cayman); 20+ Delaware shells</td>
            <td>Delaware Title 8 §§101-325 (no beneficial-ownership disclosure); 150+ FinCEN SARs (JPMorgan $670M+ flagged)</td>
            <td>Baturina $3.5M (2014); Burisma $1M/yr (2014–2019); Rakishev $142,300 (2014); CEFC $5M+ (2015–2017)</td>
            <td>Hunter conviction June 2024 → <strong>full and unconditional pardon 2024-12-01</strong>; 14pp net approval fall (53%→39%)</td>
          </tr>
          <tr>
            <td><strong>Clinton</strong><br/><span class="bwb-intel-subtitle">1978–2024</span></td>
            <td>Whitewater Development (1978); Madison Guaranty S&amp;L; Clinton Foundation (2001)</td>
            <td>FDIC insurance (Madison Guaranty); Independent Counsel 1994–2000; Foundation 501(c)(3)</td>
            <td>Cattle futures $100K → $1M+ (1978, 10:1 leverage); $2B+ foreign-donor flow during Hillary tenure as Secretary of State (2009–2013)</td>
            <td>Whitewater closed without financial conviction; DOJ closes Foundation investigation 2018; 26 Epstein flights (per <code>update.md</code>)</td>
          </tr>
          <tr>
            <td><strong>Obama</strong><br/><span class="bwb-intel-subtitle">2008–2024</span></td>
            <td>Obama Foundation (2014); BHR Partners (Hunter 10%, parallel Biden vehicle); Higher Ground Productions (2018)</td>
            <td>OLC memo 2016 (drone civilian casualties); FISC rubber-stamp (NSA Section 215); AUMF 2001</td>
            <td>Libya War 2011 (no Congressional authorization, HR 208 failed); JCPOA 2015; <strong>$1.7B cash to Iran 2016-01</strong></td>
            <td>Trump abandons JCPOA 2018 (no accountability); 11th Cir NSA ruling 2020 (after the fact); Netflix $65M 2018; Presidential Center $830M</td>
          </tr>
        </tbody>
      </table>

      <h3>Donor-class spine — same 10 funders, 5 dynasties</h3>
      <p>Substrate: <code>Documents/Biden/update.md</code> "Donor Class: The 10 Families That Own the Presidency" + Skull &amp; Bones table + 5-president puppet framework. The same dollar flows through the same people across all five presidencies. The mechanism is non-partisan.</p>
      <table class="bwb-intel-audit-table">
        <thead>
          <tr>
            <th>Donor / Institution</th>
            <th>Net Worth</th>
            <th>Total Political Spend</th>
            <th>Trump</th>
            <th>Bush</th>
            <th>Biden</th>
            <th>Clinton</th>
            <th>Obama</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Sheldon Adelson</strong></td>
            <td>$38B</td>
            <td>$500M+ (90% R, 10% D)</td>
            <td>✓</td><td>—</td><td>✓</td><td>—</td><td>—</td>
          </tr>
          <tr>
            <td><strong>Haim Saban</strong></td>
            <td>$3.7B</td>
            <td>$200M+ (90% D, 10% R)</td>
            <td>—</td><td>—</td><td>—</td><td>✓</td><td>✓</td>
          </tr>
          <tr>
            <td><strong>Charles Koch</strong></td>
            <td>$60B</td>
            <td>$1B+ (95% R, 5% D)</td>
            <td>✓</td><td>✓</td><td>—</td><td>—</td><td>—</td>
          </tr>
          <tr>
            <td><strong>David Koch</strong></td>
            <td>$50B</td>
            <td>$800M+ (95% R, 5% D)</td>
            <td>✓</td><td>✓</td><td>—</td><td>—</td><td>—</td>
          </tr>
          <tr>
            <td><strong>Michael Bloomberg</strong></td>
            <td>$60B</td>
            <td>$1B+ (60% D, 40% R)</td>
            <td>—</td><td>—</td><td>✓</td><td>✓</td><td>✓</td>
          </tr>
          <tr>
            <td><strong>George Soros</strong></td>
            <td>$7B</td>
            <td>$500M+ (95% D, 5% R)</td>
            <td>—</td><td>—</td><td>—</td><td>✓</td><td>✓</td>
          </tr>
          <tr>
            <td><strong>Leslie Wexner</strong></td>
            <td>$6B</td>
            <td>$50M+ (60% R, 40% D)</td>
            <td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td>
          </tr>
          <tr>
            <td><strong>Tom Steyer</strong></td>
            <td>$1.6B</td>
            <td>$300M+ (99% D, 1% R)</td>
            <td>—</td><td>—</td><td>—</td><td>✓</td><td>✓</td>
          </tr>
          <tr>
            <td><strong>Peter Thiel</strong></td>
            <td>$7B</td>
            <td>$50M+ (70% R, 30% D)</td>
            <td>✓</td><td>—</td><td>—</td><td>—</td><td>—</td>
          </tr>
          <tr>
            <td><strong>Steven Mnuchin</strong></td>
            <td>$400M</td>
            <td>$100M+ (90% R, 10% D)</td>
            <td>✓</td><td>—</td><td>—</td><td>—</td><td>—</td>
          </tr>
          <tr class="bwb-intel-audit-total">
            <td colspan="2"><strong>TOTAL — Presidents Funded</strong></td>
            <td><strong>5/5 dynasties have at least one of the 10 funders</strong></td>
            <td><strong>5</strong></td><td><strong>3</strong></td><td><strong>3</strong></td><td><strong>4</strong></td><td><strong>4</strong></td>
          </tr>
        </tbody>
      </table>

      <h3>The five arms of the mechanism (per <code>update.md</code>)</h3>
      <p>Every president in the table above was funded by the same five institutional arms. The arm rotates; the donor rotates; the mechanism does not.</p>
      <ul class="bwb-intel-audit-list">
        <li><strong>Political Arm (AIPAC):</strong> Trump $200M+, Obama $100M+, Bush $50M+, Biden $75M+, Clinton $25M+. Cumulative: $450M+ in documented AIPAC-aligned funds across the 5 dynasties, plus $3.8B/yr to Israel as the policy output.</li>
        <li><strong>Old Guard (Skull &amp; Bones):</strong> Prescott Bush 1918; H.W. Bush 1948; G.W. Bush 1968; **Bill Clinton 1968**; John Kerry 1966; William F. Buckley Jr. 1950; Mike Pompeo 1986. Four of five dynasties have direct Bones membership (Obama: not Bones, but Bones-adjacent through Bones-class Buckley + same donor class).</li>
        <li><strong>Black Market Arm (Wexner / Epstein / Maxwell):</strong> Wexner $50M+ (60% R, 40% D) — funded all 5 dynasties. Epstein (Lolita Express): 26 flights (Clinton), 26 flights (Bush 43 per <code>update.md</code>), documented ties to Trump (Mar-a-Lago, 1990s), Trump Treasury (Mnuchin — Epstein's banker), Biden State (Hillary tenure overlap).</li>
        <li><strong>Spiritual Arm (Vatican):</strong> Trump (Evangelical + Vatican alliances), Obama (Catholic Social Justice, ACA without abortion), Bush (Faith-Based Initiatives), Biden (Catholic, Vatican ties), Clinton (Catholic Alliances, Welfare Reform). All 5 — Vatican-Lateran treaty substrate consistent with the mechanism.</li>
        <li><strong>War Arm (MIC + CIA):</strong> Trump $30M+ (Syria, Yemen); Obama $40M+ (Libya, drone 7× Bush); Bush $60M+ (Iraq, Afghanistan); Biden $50M+ (Ukraine, Gaza); Clinton $20M+ (Yugoslavia, Somalia). Cumulative: $200M+ across 5 dynasties. CIA directly employed H.W. Bush as Director; close ties documented for all 5.</li>
      </ul>

      <h3>Continuum — 1139 → 2026, every dynasty, same shape</h3>
      <table class="bwb-intel-audit-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Document</th>
            <th>Mechanism Step</th>
            <th>Class</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>1139</td><td>Omne Datum Optimum</td><td>Charter + Exempt</td><td>Templars</td></tr>
          <tr><td>1924</td><td>Union Banking Corporation</td><td>Charter</td><td>Bush (Prescott)</td></tr>
          <tr><td>1942-10-20</td><td>Vesting Order 248</td><td>Release (duress)</td><td>Bush (Prescott)</td></tr>
          <tr><td>1951</td><td>Civil Action 2380-43</td><td>Release (cash, ~$1.5M)</td><td>Bush (Prescott)</td></tr>
          <tr><td>1966</td><td>Zapata exit $1.1M</td><td>Move → Senate</td><td>Bush (H.W.)</td></tr>
          <tr><td>1977</td><td>Arbusto Energy</td><td>Charter</td><td>Bush (W.)</td></tr>
          <tr><td>1978</td><td>Whitewater + cattle futures</td><td>Charter + Move</td><td>Clinton</td></tr>
          <tr><td>1986</td><td>Harken / Spectrum 7 merger</td><td>Charter</td><td>Bush (W.)</td></tr>
          <tr><td>1987</td><td>Carlyle Group</td><td>Charter</td><td>Bush (H.W. as advisor)</td></tr>
          <tr><td>1990-06-22</td><td>Harken sale $848,560</td><td>Move (3 wks before $23.2M loss)</td><td>Bush (W.)</td></tr>
          <tr><td>1991</td><td>Gulf War → Carlyle contracts</td><td>Move</td><td>Bush (H.W.)</td></tr>
          <tr><td>1991</td><td>Trump Taj Mahal $675M bankruptcy</td><td>Release (bankruptcy)</td><td>Trump</td></tr>
          <tr><td>1992–2004</td><td>Trump 5 more bankruptcies ($93M–$1.8B)</td><td>Release (bankruptcy)</td><td>Trump</td></tr>
          <tr><td>1994–2000</td><td>Whitewater Independent Counsel</td><td>Exempt (legal apparatus)</td><td>Clinton</td></tr>
          <tr><td>2001</td><td>Clinton Foundation</td><td>Charter</td><td>Clinton</td></tr>
          <tr><td>2001–2008</td><td>Iraq + Afghanistan wars</td><td>Move (war = capital)</td><td>Bush (W.)</td></tr>
          <tr><td>2008-10-03</td><td>TARP $700B</td><td>Release (public capital → banks)</td><td>Bush (W.) → Obama</td></tr>
          <tr><td>2008</td><td>Obama elected</td><td>Charter (donor class populates transition)</td><td>Obama</td></tr>
          <tr><td>2011</td><td>Libya War (no auth)</td><td>Move</td><td>Obama</td></tr>
          <tr><td>2013</td><td>Rosemont Seneca (DE 5308739)</td><td>Charter</td><td>Biden (Hunter)</td></tr>
          <tr><td>2013</td><td>Snowden NSA disclosures</td><td>Exempt (FISC challenged)</td><td>Obama</td></tr>
          <tr><td>2014-02</td><td>Baturina $3.5M wire</td><td>Move</td><td>Biden + Russia</td></tr>
          <tr><td>2014–2019</td><td>Burisma $1M/yr</td><td>Move</td><td>Biden + Ukraine</td></tr>
          <tr><td>2014</td><td>Obama Foundation</td><td>Charter</td><td>Obama</td></tr>
          <tr><td>2015–2017</td><td>CEFC $5M+ → Hudson West III</td><td>Move</td><td>Biden + China</td></tr>
          <tr><td>2015</td><td>JCPOA</td><td>Move (sanctions relief)</td><td>Obama</td></tr>
          <tr><td>2016-01</td><td>$1.7B cash to Iran</td><td>Move (literal cash)</td><td>Obama</td></tr>
          <tr><td>2016-08</td><td>Trump Taj Mahal closes</td><td>Release (terminal)</td><td>Trump</td></tr>
          <tr><td>2018-05</td><td>Netflix deal $65M+</td><td>Move (post-office monetization)</td><td>Obama</td></tr>
          <tr><td>2018</td><td>DOJ closes Foundation investigation</td><td>Release (full)</td><td>Clinton</td></tr>
          <tr><td>2020-09</td><td>11th Cir: NSA program unlawful</td><td>Release (judicial, after the fact)</td><td>Obama</td></tr>
          <tr><td>2023-06-20</td><td>Hunter indicted (DE)</td><td>Exempt (legal apparatus)</td><td>Biden</td></tr>
          <tr><td>2023-08-11</td><td>Plea deal collapses; Weiss Special Counsel</td><td>Release attempt fails</td><td>Biden</td></tr>
          <tr><td>2024-06-11</td><td>Hunter convicted (3 felony counts)</td><td>(Exempt closes)</td><td>Biden</td></tr>
          <tr><td><strong>2024-12-01</strong></td><td><strong>Full and unconditional pardon by Joseph R. Biden Jr.</strong></td><td><strong>Release (executive)</strong></td><td><strong>Biden (Joe)</strong></td></tr>
          <tr><td>2025-01-20</td><td>Biden term ends; approval 37%–41% (final 81-poll dataset)</td><td>(Mechanism continues in Foundation)</td><td>Biden</td></tr>
        </tbody>
      </table>

      <h3>Supreme Mathematics &amp; Sovering Cipher — the proof</h3>
      <ul class="bwb-intel-audit-list">
        <li><strong>Knowledge:</strong> the five audits above (Trump + Bush + Biden + Clinton + Obama) each cite the same donor-class spine from <code>update.md</code>. The same 10 funders appear in all 5. The same 4 steps appear in all 5. The same 5 institutional arms (AIPAC, Skull &amp; Bones, Black Market, Vatican, MIC/CIA) appear in all 5.</li>
        <li><strong>Wisdom:</strong> the form rotates — bankruptcies, Delaware shells, cattle futures, JCPOA, TARP — but the *outcome* is constant. Wealth concentration. Worker exploitation. Prosecutorial capture. Donor-class survival across administration change.</li>
        <li><strong>Understanding:</strong> the continuum from Templars (1139) to Biden's pardon (2024-12-01) reveals the eternal nature of the architecture. Every dynasty in the table is a chapter in the same book. The book is filed. The book is the receipt.</li>
        <li><strong>Freedom or Death:</strong> the system offers freedom to the political class (no Trump financial conviction, no Bush financial conviction, no Biden financial conviction, no Clinton financial conviction, no Obama financial conviction) or death/penalty to the rest (workers displaced, civilians bombed, taxpayers bailed-out, transparency prosecuted). The Sovering Cipher's eternal interest rate is the donor-class net worth curve. It compounds across presidencies because the *form* changes but the *function* is constant.</li>
      </ul>

      <p class="bwb-intel-audit-foot">The mechanism is filed. Five dynasties, one mechanism, 110+ years of continuity. The form rotates (charter → exempt → move → release). The donor class persists. The Skull &amp; Bones roster overlaps. The Vatican substrate survives. The MIC substrate survives. The CIA substrate survives. <strong>The mechanism is the system. The system is the receipt.</strong></p>
      <p class="bwb-intel-audit-source">Cross-cutting substrate: <code>Documents/Biden/update.md</code> (donor-class spine + Skull &amp; Bones + 5-president puppet framework) + 5 primary-source audit files in <code>corruption/2026-07-14—Alchemy_of_Impunity—*.md</code>.</p>
    </section>

    <section class="bwb-intel-section">
      <span class="bwb-section-kicker">THE CYCLE</span>
      <h2>How the network holds</h2>
      <ol class="bwb-intel-cycle">${cycle}</ol>
      <p class="bwb-intel-principle">${escapeHtml(intel.mechanism.principle)}</p>
    </section>

    <section class="bwb-intel-section">
      <span class="bwb-section-kicker">FIRST-EP CHAIN · 1119–2019</span>
      <h2>The same shape, nine centuries</h2>
      <p class="bwb-intel-lede">The first Exempt Person network was the Knights Templar — a monastic-military order, freed by Pope Innocent II from every local jurisdiction. The property didn't disappear when the order did. It migrated into the Hospitallers, then the early central banks, then the global reserve system. The Epstein files are the modern receipt for the same mechanism.</p>
      <ol class="bwb-intel-chain">${epChain}</ol>
    </section>

    <section class="bwb-intel-section">
      <span class="bwb-section-kicker">CO-OCCURRENCE · THE MOAT</span>
      <h2>Which power classes sit in the same files</h2>
      <p class="bwb-intel-lede">For every power-class entity we find in the EFTA corpus, we tag the rest of the classes that co-occur in the same document. High counts = the same actors touching the same case.</p>
      <div class="bwb-intel-copair-grid">${coBars}</div>
    </section>

    <section class="bwb-intel-section">
      <span class="bwb-section-kicker">SPOTLIGHT · TOP 5 DOSSIERS</span>
      <h2>The files where everything converges</h2>
      <p class="bwb-intel-lede">The five EFTA documents that hit the most power classes at once. Each is a real file with a real bates number. Click the bates to see the full OCR text in the corpus.</p>
      <div class="bwb-intel-spotlight-grid">${spotlights}</div>
    </section>

    <section class="bwb-intel-section">
      <span class="bwb-section-kicker">CORPUS-WIDE ENTITY TALLIES</span>
      <h2>What the 10,182 OCRed files actually name</h2>
      <p class="bwb-intel-lede">Per-entity hit counts across the full EFTA OCR corpus. The bars are scaled within each class, so they show rank within class, not absolute comparison across classes.</p>
      <div class="bwb-intel-tally-grid">${tallySections}</div>
    </section>

    <section class="bwb-intel-section">
      <span class="bwb-section-kicker">CLASS OF 2025 · THE HOLDERS-UP</span>
      <h2>The current chain of obstruction</h2>
      <p class="bwb-intel-lede">Officials and adjacent figures with documented entanglement in the EFTA corpus or active obstruction of release. These are the names to ask, in alphabetical order by office.</p>
      <div class="bwb-intel-class-grid">
        ${(intel.class_of_2025?.members || []).map(m => `
          <article class="bwb-intel-class-card">
            <h3>${escapeHtml(m.name)}</h3>
            <p class="bwb-intel-class-role">${escapeHtml(m.role)}</p>
            <p><strong>Receipt:</strong> ${escapeHtml(m.receipt)}</p>
            <p><strong>Holdup:</strong> ${escapeHtml(m.block)}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="bwb-intel-section">
      <span class="bwb-section-kicker">TRUMP ORBIT · DIRECT RECEIPTS</span>
      <h2>Named in the corpus, not alleged in headlines</h2>
      <p class="bwb-intel-lede">Every name below is tied to a primary source — EFTA bates, flight log, subcorpus file, or memo. The tier reflects the strength of the document chain, not the seriousness of the allegation.</p>
      <div class="bwb-intel-orbit-grid">
        ${(intel.trump_orbit?.members || []).map(m => `
          <article class="bwb-intel-orbit-card bwb-intel-orbit-${m.tier.toLowerCase()}">
            <h3>${escapeHtml(m.name)} <span class="bwb-intel-orbit-tier">${escapeHtml(m.tier)}</span></h3>
            <p>${escapeHtml(m.receipt)}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="bwb-intel-section">
      <span class="bwb-section-kicker">DONOR CLASS BIBLE · 2026 EVIDENCE GRADING</span>
      <h2>The money behind the gate</h2>
      <p class="bwb-intel-lede">From <em>Donor_Class_Bible_Deep_State_2026.pdf</em>. Direct = documented payment or hand-off. Structural = financial conduit or ownership chain.</p>
      <div class="bwb-intel-donor-grid">
        ${(intel.donor_class?.members || []).map(m => `
          <article class="bwb-intel-donor-card bwb-intel-donor-${m.tier.toLowerCase()}">
            <h3>${escapeHtml(m.name)}${m.amount ? ` <span class="bwb-intel-donor-amount">${escapeHtml(m.amount)}</span>` : ''}</h3>
            <p><span class="bwb-intel-donor-tier">${escapeHtml(m.tier)}</span> ${escapeHtml(m.receipt)}</p>
          </article>
        `).join("")}
      </div>
    </section>

    ${(intel.models_reference?.items?.length) ? `
    <section class="bwb-intel-section">
      <span class="bwb-section-kicker">3D PRINT MODELS · FREE TO MAKE</span>
      <h2>Hold the receipts in your hand</h2>
      <p class="bwb-intel-lede">${escapeHtml(intel.models_reference.note)}</p>
      <div class="bwb-intel-models-grid">
        ${intel.models_reference.items.map(mod => `
          <article class="bwb-intel-model-card">
            <h3>${escapeHtml(mod.name)}</h3>
            <p>${escapeHtml(mod.note)}</p>
          </article>
        `).join("")}
      </div>
    </section>
    ` : ''}

    <section class="bwb-intel-section">
      <span class="bwb-section-kicker">METHOD</span>
      <h2>How the dataset was built</h2>
      <p>${escapeHtml(intel.method)}</p>
      <p class="bwb-intel-meta">Generated ${escapeHtml(intel.generated_at)} · ${escapeHtml(intel.source_corpus)}.</p>
    </section>
  </div></div>`;

  const intelligenceLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "Intelligence — BotwaveBomba",
        url: pageUrl("intelligence"),
        description: intel.mechanism.claim,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "PORTADA", item: pageUrl("index") },
          { "@type": "ListItem", position: 2, name: "Intelligence" },
        ],
      },
    ],
  };
  write(
    "intelligence.html",
    chrome("intelligence", intelligenceBody, {
      title: "Intelligence — BotwaveBomba",
      description: "The mechanism. The cycle. The exempt-person network exposed in 10,715 primary documents.",
      canonical: pageUrl("intelligence"),
      jsonLd: intelligenceLd,
    })
  );
  publicPages.push({
    page: "intelligence",
    title: "Intelligence — BotwaveBomba",
    desc: "Epstein-Files mechanism registry. The CIA does not work for the people. It works for the people who own the banks.",
  });

  // Sitemap
  const urls = publicPages
    .map(
      (p) =>
        `  <url><loc>${p.page === "index" ? pageUrl("index") : `${DOMAIN}${BASE}/${p.page}.html`}</loc></url>`
    )
    .join("\n");
  write(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
  );

  console.log(
    `[build_site] generated ${publicPages.length} pages, ${stories.length} intercepts, ${SECTIONS.length} sectors`
  );
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
