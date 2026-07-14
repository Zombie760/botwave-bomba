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
  const ownership = getOwnershipByDomain();
  for (const s of stories) {
    for (const src of s.sources || []) {
      const key = (src.url || "")
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0]
        .toLowerCase();
      const owner = ownership[key];
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
  for (const src of sources) {
    const bloc = normBloc(src.bloc);
    const own = resolveOwnershipForSource(src.url || "");
    byBloc[bloc] = byBloc[bloc] || [];
    byBloc[bloc].push({ source: src, ownership: own });
  }

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
    const pct = Math.round((entries.length / totalSources) * 100);
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
          ? `<a class="bwb-evidence-link" href="${escapeHtml(evidenceUrl)}" rel="noopener" target="_blank">${escapeHtml(evidenceUrl.length > 60 ? evidenceUrl.slice(0, 60) + "…" : evidenceUrl)} ↗</a>`
          : `<span class="bwb-evidence-link bwb-evidence-link--unverified">No evidence URL on file</span>`;
        return `<article class="bwb-refraction-source">
          <header>
            <strong>${escapeHtml(source.name || "Unknown")}</strong>
            <span class="bwb-refraction-source-country">${escapeHtml(source.country || "??")}</span>
          </header>
          <p class="bwb-refraction-funder">
            <span class="bwb-refraction-funder-label">FUNDER</span>
            <span class="bwb-refraction-funder-name">${escapeHtml(parent)}</span>
            <span class="bwb-refraction-funder-type">${escapeHtml(parentType)}</span>
          </p>
          <p class="bwb-refraction-motive">${escapeHtml(motive)}</p>
          <p class="bwb-refraction-evidence">${evidenceLink}</p>
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

  // Gaps callout
  const gapsCallout = silentBlocs.length
    ? `<aside class="bwb-gaps-callout" aria-label="Coverage gaps">
        <span class="bwb-gaps-callout-kicker">BLIND SPOTS</span>
        <p>${silentBlocs.map((b) => blocLabel[b]).join(", ")} bloc${silentBlocs.length > 1 ? "s are" : " is"} silent on this story. ${totalSources} named source${totalSources === 1 ? "" : "s"} total — ${Object.values(byBloc).filter((b) => b.length).length} bloc${Object.values(byBloc).filter((b) => b.length).length === 1 ? "" : "s"} represented.</p>
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

  <section class="bwb-refraction-context" aria-label="Why this matters">
    <h2>WHY REFRACTION</h2>
    <p>The same story refracts through different ownership. The <strong>frame</strong> you see is a function of the <strong>funder</strong> behind it. BotwaveBomba surfaces the parent, the motive, and the evidence — so you can read the refraction for yourself.</p>
    <p>Compare this refraction against the unfiltered coverage on the <a href="${sectionUrl("radar")}">RADAR</a>, the <a href="${sectionUrl("black-site")}">BLACK SITE</a> index, or browse the <a href="${sectionUrl("assets")}">asset registry</a>.</p>
  </section>

  <section class="bwb-refraction-others" aria-label="More refractions">
    <h2>OTHER REFRACTIONS</h2>
    <ul class="bwb-refraction-others-list">
      ${allStories
        .filter((s) => s.id !== story.id && (s.sources?.length || 0) >= 3)
        .slice(0, 8)
        .map((s) => {
          const sb = s.sources || [];
          const sp = s.alignmentSpread || {};
          const st = Object.values(sp).reduce((a, b) => a + b, 0) || 1;
          const tline = Object.entries(sp)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${blocLabel[k] || k} ${Math.round((v / st) * 100)}%`)
            .join(" · ");
          return `<li><a href="${pageUrl("refraction")}?id=${s.id}">
            <strong>${escapeHtml((s.topHeadlines || [])[0] || "Untitled")}</strong>
            <span>${sb.length} sources · ${escapeHtml(tline)}</span>
          </a></li>`;
        })
        .join("")}
    </ul>
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
