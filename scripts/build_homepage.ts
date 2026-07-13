#!/usr/bin/env bun
/**
 * BotwaveBomba homepage static build step.
 *
 * Reads the existing clustered story pipeline (api/stories_clustered.json,
 * api/sources_real_seed.json, api/ownership.json) and bakes a static snapshot
 * into index.html:
 *   - base64-encoded bootstrap JSON for the JS renderer
 *   - a <noscript> fallback feed with real story cards and coverage stats
 *   - api/meta.json with live counts and freshness
 *
 * Usage:
 *   bun run scripts/build_homepage.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = `${import.meta.dir}/..`;
const STORIES_PATH = `${ROOT}/api/stories_clustered.json`;
const SEED_PATH = `${ROOT}/api/sources_real_seed.json`;
const OWNERSHIP_PATH = `${ROOT}/api/ownership.json`;
const META_PATH = `${ROOT}/api/meta.json`;
const INDEX_PATH = `${ROOT}/index.html`;

const BWB_BASE = "/botwavebomba";

type SourceRow = {
  name: string;
  bloc: string;
  country: string;
  url: string;
  excerpt?: string;
  framing_placeholder?: unknown;
  domain?: string;
  bias?: string;
  factuality?: string;
};

type Story = {
  id: string;
  size: number;
  source_count: number;
  bloc_spread: Record<string, number>;
  countries: string[];
  top_headlines: string[];
  primary_urls: string[];
  sources: SourceRow[];
  generated_at?: string;
  framing_summary?: string;
  summary?: string;
  section?: string;
  is_blindspot?: boolean;
  geo_frame?: string;
  has_video?: boolean;
  coverage?: { left_pct: number; right_pct: number };
};

type SeedSource = {
  name: string;
  domain: string;
  country: string;
  bloc: string;
  bias?: string;
  factfulness?: string;
  tone?: string;
  verified_at?: string;
  primary_source_url?: string;
};

type OwnershipRow = {
  domain: string;
  name: string;
  owner: string;
  owner_type: string;
  parent_company?: string;
  motive?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "\"")
    .replace(/'/g, "&#039;");
}

function initials(name: string): string {
  const clean = String(name || "").replace(/^(The|A)\s+/i, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

function classForBloc(bloc: string): string {
  return bloc === "non-aligned" ? "non-aligned" : bloc;
}

function normBloc(bloc: string): string {
  const b = String(bloc || "other").toLowerCase().replace(/_/g, "-");
  if (b === "western") return "western";
  if (b === "non-aligned" || b === "nonaligned" || b === "neutral") return "non-aligned";
  if (b === "adversarial") return "adversarial";
  return "other";
}

function formatTimeAgo(ts: string): string {
  const t = Date.parse(ts);
  if (isNaN(t)) return "";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function cardGradient(id: string): string {
  const h = hashString(id);
  return `linear-gradient(135deg, oklch(50% 0.18 ${h % 360}), oklch(40% 0.15 ${(h * 13) % 360}))`;
}

function coverageBadgeStatic(srcs: SourceRow[]): string {
  const counts = { western: 0, "non-aligned": 0, adversarial: 0 };
  srcs.forEach(s => { counts[normBloc(s.bloc)] = (counts[normBloc(s.bloc)] || 0) + 1; });
  const chips: string[] = [];
  if (counts.western) chips.push(`<span class="bwb-bloc-pill western">${counts.western}W</span>`);
  if (counts["non-aligned"]) chips.push(`<span class="bwb-bloc-pill non-aligned">${counts["non-aligned"]}N</span>`);
  if (counts.adversarial) chips.push(`<span class="bwb-bloc-pill adversarial">${counts.adversarial}A</span>`);
  return chips.length ? chips.join(" ") : '<span class="bwb-bloc-pill other">unmapped</span>';
}

function factualityBadgeStatic(srcs: SourceRow[]): string {
  const counts = { high: 0, mostly_factual: 0, medium: 0, mixed: 0, low: 0, unknown: 0 };
  srcs.forEach(s => {
    const f = String(s.factuality || s.factfulness || "unknown").toLowerCase();
    counts[f] = (counts[f] || 0) + 1;
  });
  const rated = counts.high + counts.mostly_factual + counts.medium + counts.mixed + counts.low;
  if (!rated) return '<span class="bwb-story-card-factuality unknown">&mdash;</span>';
  if (counts.high + counts.mostly_factual >= 0.7 * rated) return '<span class="bwb-story-card-factuality high">High factuality</span>';
  if (counts.low >= 0.3 * rated) return '<span class="bwb-story-card-factuality low">Low factuality</span>';
  return '<span class="bwb-story-card-factuality mixed">Mixed factuality</span>';
}

function signalBadgesStatic(story: Story): string {
  const badges: string[] = [];
  if (story.is_blindspot) badges.push('<span class="bwb-signal-badge blindspot">Blindspot</span>');
  if (story.geo_frame === "mono-frame") badges.push('<span class="bwb-signal-badge mono-frame">Mono-frame</span>');
  if (story.geo_frame === "blackout") badges.push('<span class="bwb-signal-badge blackout">W. Blackout</span>');
  return badges.join("");
}

function blocsBarStatic(srcs: SourceRow[]): string {
  const counts = { western: 0, "non-aligned": 0, adversarial: 0 };
  srcs.forEach(s => { counts[normBloc(s.bloc)] = (counts[normBloc(s.bloc)] || 0) + 1; });
  const total = Math.max(1, counts.western + counts["non-aligned"] + counts.adversarial);
  return `
    <div class="bwb-blocs-bar" aria-label="Source bloc mix">
      <div class="bwb-blocs-seg western" style="width:${(counts.western / total) * 100}%" data-label="Western ${counts.western}"></div>
      <div class="bwb-blocs-seg non-aligned" style="width:${(counts["non-aligned"] / total) * 100}%" data-label="Non-Aligned ${counts["non-aligned"]}"></div>
      <div class="bwb-blocs-seg adversarial" style="width:${(counts.adversarial / total) * 100}%" data-label="Adversarial ${counts.adversarial}"></div>
    </div>
  `;
}

function buildStaticCard(story: Story): string {
  const srcs = story.sources || [];
  const first = srcs[0] || { name: "Unknown source", bloc: "other", domain: "" };
  const headline = escapeHtml(story.top_headlines?.[0] || "Untitled story");
  const countries = new Set(srcs.map(s => s.country).filter(Boolean));
  const summary = story.framing_summary || story.summary || "";

  const logoUrl = first.domain ? `https://logo.clearbit.com/${first.domain}` : "";
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="bwb-story-card-logo-fallback">${initials(first.name)}</span>`
    : `<span class="bwb-story-card-logo-fallback">${initials(first.name)}</span>`;

  return `
    <article class="bwb-story-card">
      <a href="${BWB_BASE}/story.html?id=${encodeURIComponent(story.id)}" class="bwb-story-card-link" aria-label="Read full coverage of: ${headline}">
        <div class="bwb-story-card-header">
          <div class="bwb-story-card-logo">${logoHtml}</div>
          <span class="bwb-story-card-source-name">${escapeHtml(first.name)}</span>
          <span class="bwb-story-card-bloc ${classForBloc(normBloc(first.bloc))}">${normBloc(first.bloc) === "western" ? "Western" : normBloc(first.bloc) === "adversarial" ? "Adversarial" : "Non-Aligned"}</span>
          ${factualityBadgeStatic(srcs)}
        </div>
        <h3 class="bwb-story-card-title">${headline}</h3>
        <p class="bwb-story-card-excerpt">${escapeHtml(summary.slice(0, 180) + (summary.length > 180 ? "\u2026" : ""))}</p>
        <div class="bwb-story-card-blocs">${blocsBarStatic(srcs)}</div>
        <div class="bwb-story-card-meta">
          <span class="bwb-story-card-time">${formatTimeAgo(story.generated_at || "") || "just now"}</span>
          <div class="bwb-story-card-counts">
            <span class="bwb-story-card-count">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              ${srcs.length} source${srcs.length === 1 ? "" : "s"}
            </span>
            <span class="bwb-story-card-count">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              ${countries.size} countr${countries.size === 1 ? "y" : "ies"}
            </span>
          </div>
          <div class="bwb-story-card-badges">${signalBadgesStatic(story)}</div>
        </div>
      </a>
      <button class="bwb-card-expand" type="button" aria-expanded="false" aria-controls="sources-${story.id}" data-expand="${story.id}">
        <span class="bwb-card-expand-label">show ${srcs.length} sources</span>
      </button>
      <div class="bwb-card-sources" id="sources-${story.id}" hidden>
        <ul>
          ${srcs.map(s => {
            const o = s.domain && ownershipRows.find((e: any) => e.domain === s.domain);
            const ownerLine = o?.owner ? `<span class="bwb-card-source-owner" title="${o.owner_type || "owner"}${o.parent_company ? " \u00b7 parent: " + o.parent_company : ""}${o.motive ? " \u00b7 " + o.motive : ""}">${o.owner}</span>` : "";
            return `
            <li class="bwb-card-source-row">
              <span class="bwb-card-source-bloc ${classForBloc(normBloc(s.bloc))}"></span>
              <span class="bwb-card-source-name">${escapeHtml(s.name || "Unknown")}</span>
              ${ownerLine}
              ${s.country ? `<span class="bwb-card-source-country">${escapeHtml(s.country)}</span>` : ""}
              <a href="${escapeHtml(s.url || "#")}" target="_blank" rel="noopener" class="bwb-card-source-link">\u2197</a>
            </li>`;
          }).join("")}
        </ul>
      </div>
    </article>
  `;
}

function replaceMarker(html: string, marker: string, replacement: string): string {
  const open = `<!-- BWB_${marker} -->`;
  const close = `<!-- /BWB_${marker} -->`;
  const idx = html.indexOf(open);
  if (idx === -1) {
    console.warn(`marker ${marker} not found in index.html`);
    return html;
  }
  const end = html.indexOf(close, idx);
  if (end === -1) {
    console.warn(`marker ${marker} close not found in index.html`);
    return html;
  }
  return html.slice(0, idx + open.length) + "\n" + replacement + "\n" + html.slice(end);
}

function diversityScore(sources: SourceRow[]): number {
  if (sources.length < 2) return 0;
  const left = sources.filter(s => s.bias === "left" || s.bias === "lean-left").length;
  const right = sources.filter(s => s.bias === "right" || s.bias === "lean-right").length;
  const center = sources.filter(s => s.bias === "center" || !s.bias).length;
  const n = sources.length;
  const c = (left / n) ** 2 + (center / n) ** 2 + (right / n) ** 2;
  const lcr = Math.max(0, Math.min(1, (1 - c) / 0.67)) * 50;
  const blocs = new Set(sources.map(s => normBloc(s.bloc))).size;
  const blocPart = (blocs / 3) * 50;
  return Math.round(lcr + blocPart);
}

function main() {
  const storiesJson = JSON.parse(readFileSync(STORIES_PATH, "utf8"));
  const seedJson = JSON.parse(readFileSync(SEED_PATH, "utf8"));
  const ownershipJson: { ownership?: OwnershipRow[] } = JSON.parse(readFileSync(OWNERSHIP_PATH, "utf8"));

  const stories: Story[] = storiesJson.stories || [];
  const seedSources: SeedSource[] = seedJson.sources || [];
  const ownershipRows = ownershipJson.ownership || [];

  const allSrcs = stories.flatMap((s) => s.sources || []);
  const countries = new Set(allSrcs.map((s) => s.country).filter(Boolean));
  const blocs: Record<string, number> = { western: 0, "non-aligned": 0, adversarial: 0, other: 0 };
  allSrcs.forEach((s) => { const b = normBloc(s.bloc); blocs[b] = (blocs[b] || 0) + 1; });
  const totalBloc = blocs.western + blocs["non-aligned"] + blocs.adversarial + blocs.other || 1;
  const wPct = Math.round((blocs.western / totalBloc) * 100);
  const nPct = Math.round((blocs["non-aligned"] / totalBloc) * 100);
  const aPct = Math.round((blocs.adversarial / totalBloc) * 100);
  const diversity = Math.round(stories.reduce((sum, s) => sum + diversityScore(s.sources || []), 0) / (stories.length || 1));

  const biggest =
    blocs.western >= blocs["non-aligned"] && blocs.western >= blocs.adversarial
      ? ["Western", wPct]
      : blocs["non-aligned"] >= blocs.adversarial
        ? ["Non-Aligned", nPct]
        : ["Adversarial", aPct];
  const smallestPct = Math.min(wPct, nPct, aPct);
  const smallestName = smallestPct === wPct ? "Western" : smallestPct === nPct ? "Non-Aligned" : "Adversarial";

  const generatedAt = storiesJson.generated_at || new Date().toISOString();

  const meta = {
    generated_at: generatedAt,
    story_count: stories.length,
    source_count_total: allSrcs.length,
    source_registry_count: seedSources.length,
    country_count: countries.size,
    bloc_spread: { western: wPct, "non-aligned": nPct, adversarial: aPct },
    diversity_score: diversity,
    coverage_gap_headline: `${biggest[0]} press leads at ${biggest[1]}%. ${smallestName} press trails at ${smallestPct}%. ${countries.size} countries represented.`,
  };
  writeFileSync(META_PATH, JSON.stringify(meta, null, 2));

  const bootstrap = {
    generated_at: generatedAt,
    stories,
    sources: seedSources,
    ownership: ownershipRows,
    stats: {
      story_count: stories.length,
      source_count: seedSources.length,
      generated_at: generatedAt,
    },
    sections: [
      { id: "world", label: "World" },
      { id: "politics", label: "Politics" },
      { id: "conflict", label: "Conflict" },
      { id: "business", label: "Business" },
    ],
  };

  const bootstrapJson = Buffer.from(JSON.stringify(bootstrap)).toString("base64");
  const bootstrapScript = `<script type="application/json" id="bwb-bootstrap-data" data-encoding="base64">${bootstrapJson}</script>`;

  // Generate noscript fallback with new card structure
  const noscriptCards = stories.slice(0, 31).map(buildStaticCard).join("\n");

  const noscript = `
<noscript>
  <style>
    #story-feed { display: none !important; }
    .bwb-empty { display: none !important; }
    .bwb-skeleton-card { display: none !important; }
  </style>
  <div class="bwb-editorial-frame" aria-label="Daily Blindspot Brief signup">
    <div class="bwb-editorial-frame-meta">
      <span class="bwb-editorial-frame-stat">${meta.story_count} stories indexed</span>
      <span class="bwb-editorial-frame-sep">\u00b7</span>
      <span class="bwb-editorial-frame-stat">${meta.source_registry_count} sources live</span>
      <span class="bwb-editorial-frame-sep">\u00b7</span>
      <span class="bwb-editorial-frame-stat">3 blocs</span>
      <span class="bwb-editorial-frame-sep">\u00b7</span>
      <span class="bwb-editorial-frame-stat bwb-corpus-age">corpus ${formatTimeAgo(generatedAt)}</span>
      <span class="bwb-editorial-frame-sep">\u00b7</span>
      <a href="${BWB_BASE}/methodology.html" class="bwb-editorial-frame-stat bwb-editorial-frame-link">methodology \u2197</a>
    </div>
  </div>
  <aside class="bwb-coverage-gap" aria-label="Today's coverage gap">
    <div class="bwb-cg-eyebrow">TODAY'S COVERAGE GAP</div>
    <div class="bwb-cg-row">
      <div class="bwb-cg-stat"><span class="bwb-cg-num">${meta.story_count}</span><span class="bwb-cg-lbl">stories</span></div>
      <div class="bwb-cg-stat"><span class="bwb-cg-num">${meta.source_count_total}</span><span class="bwb-cg-lbl">sources</span></div>
      <div class="bwb-cg-stat"><span class="bwb-cg-num">${meta.country_count}</span><span class="bwb-cg-lbl">countries</span></div>
      <div class="bwb-cg-stat"><span class="bwb-cg-num">${meta.diversity_score}</span><span class="bwb-cg-lbl">diversity score</span></div>
      <div class="bwb-cg-bar-wrap">
        <div class="bwb-cg-bar-lbl">Bloc mix</div>
        <div class="bwb-cg-bar">
          <div class="bwb-cg-seg western" style="width:${wPct}%" title="Western: ${wPct}%" data-label="Western ${wPct}%"><span>Western</span></div>
          <div class="bwb-cg-seg non-aligned" style="width:${nPct}%" title="Non-Aligned: ${nPct}%" data-label="Non-Aligned ${nPct}%"><span>Non-Aligned</span></div>
          <div class="bwb-cg-seg adversarial" style="width:${aPct}%" title="Adversarial: ${aPct}%" data-label="Adversarial ${aPct}%"><span>Adversarial</span></div>
        </div>
        <div class="bwb-cg-bar-legend">
          <span class="bwb-bloc-bullet western"></span>Western ${wPct}%
          <span class="bwb-bloc-bullet non-aligned"></span>Non-Aligned ${nPct}%
          <span class="bwb-bloc-bullet adversarial"></span>Adversarial ${aPct}%
        </div>
      </div>
      <div class="bwb-cg-headline"><strong>Today's coverage gap:</strong> ${meta.coverage_gap_headline}</div>
    </div>
  </aside>
  <section class="bwb-brief-cta" aria-label="Today's 3 picks">
    <div class="bwb-brief-cta-inner">
      <div class="bwb-brief-cta-eyebrow">Today's Blindspot Brief</div>
      <h2 class="bwb-brief-cta-title">3 picks where the gap is widest</h2>
      <p class="bwb-brief-cta-body">Enable JavaScript for interactive brief picks.</p>
      <a class="bwb-brief-cta-link" href="${BWB_BASE}/brief.html">Read the full brief \u2192</a>
    </div>
  </section>
  <main class="bwb-feed" aria-label="Story feed" role="feed">
    ${noscriptCards}
  </main>
`;

  let html = readFileSync(INDEX_PATH, "utf8");
  html = replaceMarker(html, "BOOTSTRAP_DATA", bootstrapScript);
  html = replaceMarker(html, "NOSCRIPT_FALLBACK", noscript);
  writeFileSync(INDEX_PATH, html);

  console.log(`[build_homepage] meta=${JSON.stringify(meta)}`);
  console.log(`[build_homepage] updated ${INDEX_PATH} and ${META_PATH}`);
}

main();
