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
};

type SeedSource = {
  name: string;
  domain: string;
  country: string;
  bloc: string;
  bias?: string;
  factfulness?: string;
  tone?: string;
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
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

function diversityScore(sources: SourceRow[]): number {
  if (sources.length < 2) return 0;
  const biasBuckets = sources.map((s) => {
    const b = String(s.bloc || "").toLowerCase();
    if (b === "western") return "left";
    if (b === "adversarial") return "right";
    return "center";
  });
  const n = biasBuckets.length;
  const left = biasBuckets.filter((b) => b === "left").length / n;
  const right = biasBuckets.filter((b) => b === "right").length / n;
  const center = biasBuckets.filter((b) => b === "center").length / n;
  const c = left ** 2 + right ** 2 + center ** 2;
  const lcr = Math.max(0, Math.min(1, (1 - c) / 0.67)) * 50;
  const blocs = new Set(sources.map((s) => s.bloc)).size;
  const blocPart = (blocs / 3) * 50;
  return Math.round(lcr + blocPart);
}

function normBloc(bloc: string): string {
  const b = String(bloc || 'other').toLowerCase().replace(/_/g, '-');
  if (b === 'western') return 'western';
  if (b === 'non-aligned' || b === 'nonaligned' || b === 'neutral') return 'non-aligned';
  if (b === 'adversarial') return 'adversarial';
  return 'other';
}

function coverageBadge(sources: SourceRow[]): string {
  const counts: Record<string, number> = {};
  sources.forEach((s) => { const b = normBloc(s.bloc); counts[b] = (counts[b] || 0) + 1; });
  const chips: string[] = [];
  if (counts.western) chips.push(`<span class="bwb-bloc-pill western">${counts.western}W</span>`);
  if (counts["non-aligned"]) chips.push(`<span class="bwb-bloc-pill non-aligned">${counts["non-aligned"]}N</span>`);
  if (counts.adversarial) chips.push(`<span class="bwb-bloc-pill adversarial">${counts.adversarial}A</span>`);
  return chips.length ? chips.join(" ") : '<span class="bwb-bloc-pill other">unmapped</span>';
}

function buildStaticCard(story: Story): string {
  const srcs = story.sources || [];
  const first = srcs[0] || { name: "Unknown source", bloc: "other" };
  const headline = escapeHtml(story.top_headlines?.[0] || "Untitled story");
  const snippet = "";
  return `
    <article class="bwb-story-card">
      <a href="${BWB_BASE}/story.html?id=${encodeURIComponent(story.id)}" class="bwb-story-card-link">
        <div class="bwb-story-card-header">
          <span class="bwb-story-source-initials ${classForBloc(first.bloc)}">${initials(first.name)}</span>
          <span class="bwb-story-source-name">${escapeHtml(first.name)}</span>
          <span class="bwb-story-coverage">${coverageBadge(srcs)}</span>
        </div>
        <h3 class="bwb-story-card-title">${headline}</h3>
        ${snippet ? `<p class="bwb-story-card-snippet">${snippet}</p>` : ""}
        <div class="bwb-story-card-meta">
          <span class="bwb-story-card-time">${formatTimeAgo(story.generated_at || "") || "just now"}</span>
          <span class="bwb-story-card-count">${srcs.length} source${srcs.length === 1 ? "" : "s"}</span>
        </div>
      </a>
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

  const noscript = `
<noscript>
  <style>
    #story-feed { display: none !important; }
    .bwb-empty { display: none !important; }
  </style>
  <div class="bwb-editorial-frame" aria-label="Daily Blindspot Brief signup">
    <div class="bwb-editorial-frame-meta">
      <span class="bwb-editorial-frame-stat">${meta.story_count} stories indexed</span>
      <span class="bwb-editorial-frame-sep">·</span>
      <span class="bwb-editorial-frame-stat">${meta.source_registry_count} sources live</span>
      <span class="bwb-editorial-frame-sep">·</span>
      <span class="bwb-editorial-frame-stat">3 blocs</span>
      <span class="bwb-editorial-frame-sep">·</span>
      <span class="bwb-editorial-frame-stat bwb-corpus-age">corpus ${formatTimeAgo(generatedAt)}</span>
      <span class="bwb-editorial-frame-sep">·</span>
      <a href="${BWB_BASE}/methodology.html" class="bwb-editorial-frame-stat bwb-editorial-frame-link">methodology ↗</a>
    </div>
  </div>
  <aside class="bwb-coverage-gap" aria-label="Today's coverage gap">
    <div class="bwb-cg-eyebrow">TODAY'S COVERAGE GAP</div>
    <div class="bwb-cg-row">
      <div class="bwb-cg-stat"><span class="bwb-cg-num">${meta.story_count}</span><span class="bwb-cg-lbl">stories</span></div>
      <div class="bwb-cg-stat"><span class="bwb-cg-num">${meta.source_count_total}</span><span class="bwb-cg-lbl">sources</span></div>
      <div class="bwb-cg-stat"><span class="bwb-cg-num">${meta.country_count}</span><span class="bwb-cg-lbl">countries</span></div>
      <div class="bwb-cg-bar-wrap">
        <div class="bwb-cg-bar-lbl">BLOC MIX</div>
        <div class="bwb-cg-bar">
          <div class="bwb-cg-seg western" style="width:${wPct}%" title="Western: ${wPct}%"><span>Western</span></div>
          <div class="bwb-cg-seg non-aligned" style="width:${nPct}%" title="Non-Aligned: ${nPct}%"><span>Non-Aligned</span></div>
          <div class="bwb-cg-seg adversarial" style="width:${aPct}%" title="Adversarial: ${aPct}%"><span>Adversarial</span></div>
        </div>
        <div class="bwb-cg-bar-legend">
          <span class="bwb-bloc-bullet western"></span>Western ${wPct}%
          <span class="bwb-bloc-bullet non-aligned"></span>Non-Aligned ${nPct}%
          <span class="bwb-bloc-bullet adversarial"></span>Adversarial ${aPct}%
        </div>
      </div>
      <div class="bwb-cg-stat"><span class="bwb-cg-num">${meta.diversity_score}</span><span class="bwb-cg-label">Diversity Score</span></div>
      <div class="bwb-cg-headline"><strong>Today's coverage gap:</strong> ${meta.coverage_gap_headline}</div>
    </div>
  </aside>
  <main class="bwb-main">
    <div class="bwb-feed">
      ${stories.slice(0, 31).map(buildStaticCard).join("\n")}
    </div>
  </main>
</noscript>
`;

  let html = readFileSync(INDEX_PATH, "utf8");
  html = replaceMarker(html, "BOOTSTRAP_DATA", bootstrapScript);
  html = replaceMarker(html, "NOSCRIPT_FALLBACK", noscript);
  writeFileSync(INDEX_PATH, html);

  console.log(`[build_homepage] meta=${JSON.stringify(meta)}`);
  console.log(`[build_homepage] updated ${INDEX_PATH} and ${META_PATH}`);
}

main();
