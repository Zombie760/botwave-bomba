#!/usr/bin/env bun
/**
 * BotwaveBomba Daily Blindspot Brief renderer.
 *
 * Reads api/stories_clustered.json, scores stories by non-west coverage × entropy
 * × log2(source_count+1), picks the top N, enriches source rows with real excerpts
 * from data/excerpts_YYYY-MM-DD.jsonl and real-source metadata from
 * api/sources_real_seed.json, then emits daily/YYYY-MM-DD.html + email/YYYY-MM-DD.txt.
 *
 * Usage:
 *   bun run scripts/render_brief.ts --date 2026-07-13 [--top 3]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";

const TODAY = new Date().toISOString().slice(0, 10);

const { values } = parseArgs({
  options: {
    stories: { type: "string", default: "/var/home/gringo/botwave-bomba/api/stories_clustered.json" },
    excerpts: { type: "string", default: `/var/home/gringo/botwave-bomba/data/excerpts_${TODAY}.jsonl` },
    seed: { type: "string", default: "/var/home/gringo/botwave-bomba/api/sources_real_seed.json" },
    date: { type: "string", default: TODAY },
    top: { type: "string", default: "3" },
    "html-out": { type: "string", default: "" },
    "email-out": { type: "string", default: "" },
  },
});

const STORIES_PATH = values.stories!;
const EXCERPTS_PATH = values.excerpts!;
const SEED_PATH = values.seed!;
const DATE = values.date!;
const TOP = parseInt(values.top!, 10);
const HTML_OUT = values["html-out"]! || `/var/home/gringo/botwave-bomba/daily/${DATE}.html`;
const EMAIL_OUT = values["email-out"]! || `/var/home/gringo/botwave-bomba/email/${DATE}.txt`;
const JSON_OUT = `/var/home/gringo/botwave-bomba/daily/${DATE}.json`;

type SeedSource = {
  name: string;
  domain: string;
  country: string;
  bloc: string;
  bias?: string;
  factfulness?: string;
  tone?: string;
  primary_source_url?: string;
};

type ExcerptRow = {
  hash: string;
  url: string;
  source_name: string;
  source_domain: string;
  headline: string;
  excerpt: string;
  excerpt_source: string;
  status_code: number;
  fetched_at: string;
  error?: string;
};

type SourceRow = {
  name: string;
  bloc: string;
  country: string;
  url: string;
  excerpt: string;
  framing_placeholder: null;
  bias?: string;
  factfulness?: string;
  primary_source_url?: string;
};

type Story = {
  id: string;
  size: number;
  source_count: number;
  bloc_spread: { western: number; non_aligned: number; adversarial: number };
  countries: string[];
  top_headlines: string[];
  primary_urls: string[];
  sources: SourceRow[];
};

function normalizeDomain(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function loadSeed(path: string): Map<string, SeedSource> {
  const map = new Map<string, SeedSource>();
  if (!existsSync(path)) return map;
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as { sources: SeedSource[] };
    for (const s of data.sources || []) {
      if (s?.domain) map.set(s.domain.toLowerCase(), s);
    }
  } catch { /* optional */ }
  return map;
}

function loadExcerpts(path: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as ExcerptRow;
      if (r?.url && r.excerpt) map.set(r.url, r.excerpt);
    } catch { /* skip */ }
  }
  return map;
}

function enrichStories(stories: Story[], seed: Map<string, SeedSource>, excerpts: Map<string, string>): Story[] {
  for (const story of stories) {
    for (const src of story.sources) {
      const domain = normalizeDomain(src.url).toLowerCase();
      const meta = domain ? seed.get(domain) : undefined;
      if (meta) {
        src.name = meta.name;
        src.country = meta.country;
        src.bloc = meta.bloc.replace(/_/g, "-"); // non_aligned -> non-aligned
        src.bias = meta.bias;
        src.factfulness = meta.factfulness;
        src.primary_source_url = meta.primary_source_url;
      }
      const ex = excerpts.get(src.url);
      if (ex && ex.length > 40) src.excerpt = ex.slice(0, 320);
    }
  }
  return stories;
}

const DEDUP_STOP = new Set(["after", "being", "months", "united", "states", "press", "world"]);
function sigUnigrams(s: Story): Set<string> {
  return new Set(
    (s.top_headlines[0] || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/).filter((w) => w.length >= 5 && !DEDUP_STOP.has(w))
  );
}

function shannonEntropy(spread: { western: number; non_aligned: number; adversarial: number }): number {
  const total = spread.western + spread.non_aligned + spread.adversarial;
  if (total === 0) return 0;
  const ps = [spread.western / total, spread.non_aligned / total, spread.adversarial / total].filter((p) => p > 0);
  return -ps.reduce((h, p) => h + p * Math.log2(p), 0);
}

function score(s: Story): number {
  const total = s.bloc_spread.western + s.bloc_spread.non_aligned + s.bloc_spread.adversarial;
  const nonWestPct = total === 0 ? 0 : (s.bloc_spread.non_aligned + s.bloc_spread.adversarial) / total;
  return nonWestPct * shannonEntropy(s.bloc_spread) * Math.log2(s.source_count + 1);
}

function sectionFor(s: Story): string {
  const h = (s.top_headlines[0] || "").toLowerCase();
  if (/\b(world cup|cup|match|beat|wins?|semi-final|final|league|football|soccer)\b/.test(h)) return "SPORTS";
  if (/(quake|wildfire|flood|storm|eruption|death toll|killed|rescued|kidnap)/.test(h)) return "DISASTERS";
  if (/(dies|funeral|laid to rest|obituary|passes away)/.test(h)) return "OBITUARY";
  if (/(trade|tariff|market|stock|economy|sanction)/.test(h)) return "ECONOMY";
  return "WORLD";
}

function blocLabel(b: string): string {
  if (b === "western") return "western";
  if (b === "adversarial") return "adversarial";
  return "non-aligned";
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pickPrimarySources(s: Story, n: number): SourceRow[] {
  const seen = new Set<string>();
  const out: SourceRow[] = [];
  for (const r of s.sources) {
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    out.push(r);
    if (out.length >= n) break;
  }
  return out;
}

function coverageLine(rank: number, s: Story): string {
  const sp = s.bloc_spread;
  const total = sp.western + sp.non_aligned + sp.adversarial;
  const nonWestPct = total === 0 ? 0 : Math.round(((sp.non_aligned + sp.adversarial) / total) * 100);
  const ent = shannonEntropy(sp).toFixed(2);
  const prim = pickPrimarySources(s, 3)
    .map((r) => `${r.name} (${r.country}) · ${blocLabel(r.bloc)}`)
    .join(", ");
  const more = s.source_count > 3 ? ` +${s.source_count - 3} more` : "";
  return `#${rank} · ${sectionFor(s)} · "${s.top_headlines[0] || ""}"\nCoverage in the working corpus: ${s.source_count} sources (${sp.western} western/${sp.non_aligned} non-aligned/${sp.adversarial} adversarial), ${s.countries.length} geo cells, entropy ${ent}, ${nonWestPct}% non-Western. Primary URLs: ${prim}${more}.\nThis is a regional story the US-partisan axis is structurally blind to. If you cover it, you're getting the framing from the place where it actually happened.`;
}

const INLINE_CSS = `
    html { -webkit-text-size-adjust: 100%; }
    body { background: var(--bg); color: var(--fg); font-family: 'DM Sans', sans-serif; line-height: 1.5; margin: 0; -webkit-font-smoothing: antialiased; }
    a { color: var(--primary); }
    .bwb-brief-wrap { max-width: 720px; margin: 0 auto; padding: 48px 24px 80px; }
    .bwb-brief-hero { border-bottom: 1px solid var(--card-border); padding-bottom: 28px; margin-bottom: 32px; }
    .bwb-brief-hero .kicker { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--primary); margin: 0 0 8px; }
    .bwb-brief-hero h1 { font-family: 'Playfair Display', serif; font-size: 38px; line-height: 1.1; margin: 0 0 14px; color: var(--fg); }
    .bwb-brief-hero .lede { font-size: 16px; line-height: 1.6; color: var(--fg-dim); max-width: 600px; margin: 0; font-family: 'DM Sans', sans-serif; }
    .bwb-brief-item { border-top: 1px solid var(--card-border); padding: 32px 0; }
    .bwb-brief-item:first-of-type { border-top: none; padding-top: 0; }
    .bwb-brief-headline { font-family: 'Playfair Display', serif; font-size: 22px; line-height: 1.25; margin: 0 0 14px; color: var(--fg); }
    .bwb-brief-body { font-family: 'DM Mono', monospace; font-size: 13px; line-height: 1.75; color: var(--fg); white-space: pre-wrap; margin: 0 0 16px; padding: 14px 16px; background: var(--card-bg); border-left: 3px solid var(--primary); border-radius: 0 8px 8px 0; }
    .bwb-brief-excerpt { font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.6; color: var(--fg-dim); margin: 0 0 16px; }
    .bwb-brief-meta { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--fg-dim); margin-bottom: 12px; }
    .bwb-brief-links { margin: 12px 0; }
    .bwb-brief-links summary { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--fg-dim); cursor: pointer; padding: 4px 0; }
    .bwb-brief-links ol { font-family: 'DM Mono', monospace; font-size: 11px; line-height: 1.7; padding-left: 22px; margin: 8px 0 0; color: var(--fg-dim); }
    .bwb-brief-links li { word-break: break-all; margin-bottom: 4px; }
    .bwb-brief-links a { color: var(--primary); }
    .bwb-brief-story { font-family: 'DM Mono', monospace; font-size: 12px; margin: 12px 0 0; }
    .bwb-brief-story a { color: var(--primary); }
    .bwb-brief-page-meta { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--fg-dim); margin-top: 48px; padding-top: 20px; border-top: 1px solid var(--card-border); }
    .bwb-brief-page-meta a { color: var(--primary); }
    .bwb-brief-cta { background: var(--card-bg); border: 1px solid var(--primary); padding: 24px; margin: 40px 0 0; text-align: center; border-radius: 12px; }
    .bwb-brief-cta h3 { font-family: 'Playfair Display', serif; font-size: 22px; margin: 0 0 8px; color: var(--fg); }
    .bwb-brief-cta p { font-size: 14px; color: var(--fg-dim); margin: 0 0 16px; font-family: 'DM Sans', sans-serif; }
    .bwb-brief-cta a { display: inline-block; background: var(--primary); color: #fff; text-decoration: none; padding: 12px 28px; font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; border-radius: 999px; }
    .bwb-brief-source-chip { display: inline-block; font-family: 'DM Mono', monospace; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-right: 6px; text-transform: uppercase; }
    .bwb-brief-source-chip.western { background: var(--bias-western); color: white; }
    .bwb-brief-source-chip.non-aligned { background: var(--bias-non-aligned); color: white; }
    .bwb-brief-source-chip.adversarial { background: var(--bias-adversarial); color: white; }
    @media (max-width: 480px) { .bwb-brief-hero h1 { font-size: 30px; } .bwb-brief-wrap { padding: 32px 16px 64px; } }
  `;

function renderHtml(date: string, picks: Story[]): string {
  const items = picks.map((s, i) => {
    const rank = i + 1;
    const prim = pickPrimarySources(s, 5);
    const lis = prim.map((r) => `        <li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a></li>`).join("\n");
    const chips = prim.slice(0, 3).map((r) => `<span class="bwb-brief-source-chip ${blocLabel(r.bloc)}">${esc(r.name)} (${r.country})</span>`).join("");
    const topExcerpt = s.sources.find((r) => r.excerpt && r.excerpt.length > 40)?.excerpt || "";
    const excerptHtml = topExcerpt ? `<p class="bwb-brief-excerpt">${esc(topExcerpt)}</p>` : "";
    return `    <article class="bwb-brief-item">
      <h2 class="bwb-brief-headline">${esc(s.top_headlines[0] || "(untitled story)")}</h2>
      <div class="bwb-brief-meta">${chips}</div>
      ${excerptHtml}
      <pre class="bwb-brief-body">${esc(coverageLine(rank, s))}</pre>
      <details class="bwb-brief-links">
        <summary>Primary sources (${prim.length})</summary>
        <ol>
${lis}
        </ol>
      </details>
      <p class="bwb-brief-story"><a href="story.html?id=${s.id}">View full coverage →</a></p>
    </article>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <base href="/botwavebomba/">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>DAILY BLINDSPOT BRIEF — ${date} — BOTWAVEBOMBA</title>
  <meta name="description" content="Three stories. One structural gap each. 5 minutes. The brief that names what the rest of the press didn't.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Mono:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&family=Inter:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/theme.css">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/base.css">
  <style>${INLINE_CSS}</style>
</head>
<body>
  <header data-bwb-chrome="compact"></header>
  <main class="bwb-brief-wrap">
    <section class="bwb-brief-hero">
      <p class="kicker">Daily Blindspot Brief · ${date}</p>
      <h1>Three stories. One gap each. 5 minutes.</h1>
      <p class="lede">Every morning, this brief picks 3 stories from the clustered working corpus where the structural coverage gap is widest. Each one is a receipt — the primary URLs, the bloc spread, the geographic spread, and a lede excerpt where available. Read it, you know what the rest of the press didn't cover.</p>
    </section>

${items}

    <aside class="bwb-brief-cta">
      <h3>Get this in your inbox every morning.</h3>
      <p>7am Pacific. $49/mo or $499/yr. Cancel anytime.</p>
      <a href="signup.html">Subscribe →</a>
    </aside>
    <p class="bwb-brief-page-meta">
      Generated ${new Date().toISOString()} ·
      clustered from the recent gather · <a href="methodology.html">methodology</a> ·
      <a href="brief.html">archive</a>
    </p>
  </main>
</body>
</html>`;
}

function renderEmail(date: string, picks: Story[]): string {
  const blocks = picks.map((s, i) => {
    const rank = i + 1;
    const prim = pickPrimarySources(s, 5);
    const head = `#${rank}  ${s.top_headlines[0] || "(untitled story)"}`;
    const urls = prim.map((r) => `  - ${r.url}`).join("\n");
    const topExcerpt = s.sources.find((r) => r.excerpt && r.excerpt.length > 40)?.excerpt || "";
    const excerptBlock = topExcerpt ? `\nLEDE EXCERPT:\n${topExcerpt.slice(0, 220)}${topExcerpt.length > 220 ? "..." : ""}\n` : "";
    return `------------------------------------------------------------\n${head}\n------------------------------------------------------------\n${coverageLine(rank, s)}${excerptBlock}\n\nPRIMARY SOURCES:\n${urls}\n\nFULL COVERAGE: https://botwavebomba.comstory.html?id=${s.id}`;
  }).join("\n\n");
  return `DAILY BLINDSPOT BRIEF — ${date}
============================================================

Three stories. One structural gap each. 5 minutes.

From the clustered working corpus. Each pick scored by
non_west_pct × entropy × log(source_count).

${blocks}

============================================================

You are reading this because you subscribed at $49/mo or $499/yr.
Manage your subscription: https://botwavebomba.com/account.html
Methodology: https://botwavebomba.com/methodology.html
Archive: https://botwavebomba.com/brief.html

BOTWAVEBOMBA · Not Left/Right. Who Owns The Story.`;
}

function storySummary(s: Story, rank: number) {
  const total = s.bloc_spread.western + s.bloc_spread.non_aligned + s.bloc_spread.adversarial;
  return {
    rank,
    id: s.id,
    headline: s.top_headlines[0] || "(untitled story)",
    section: sectionFor(s),
    sources: s.source_count,
    score: +score(s).toFixed(3),
    non_west_pct: total === 0 ? 0 : Math.round(((s.bloc_spread.non_aligned + s.bloc_spread.adversarial) / total) * 100),
    entropy: +shannonEntropy(s.bloc_spread).toFixed(2),
    countries: s.countries,
    primary_sources: pickPrimarySources(s, 5).map((r) => ({
      name: r.name,
      bloc: blocLabel(r.bloc),
      country: r.country,
      url: r.url,
      excerpt: r.excerpt || "",
    })),
    excerpt_enriched: s.sources.some((r) => r.excerpt && r.excerpt.length > 40),
  };
}

function main() {
  if (!existsSync(STORIES_PATH)) {
    console.error(`stories file not found: ${STORIES_PATH}`);
    process.exit(1);
  }

  const seed = loadSeed(SEED_PATH);
  const excerpts = loadExcerpts(EXCERPTS_PATH);
  const data = JSON.parse(readFileSync(STORIES_PATH, "utf8")) as { stories: Story[] };

  enrichStories(data.stories, seed, excerpts);

  const ranked = [...data.stories].sort((a, b) => score(b) - score(a));
  const picks: Story[] = [];
  const taken = new Set<string>();
  for (const s of ranked) {
    if (picks.length >= TOP) break;
    const u = sigUnigrams(s);
    const overlap = [...u].some((x) => taken.has(x));
    if (overlap) continue;
    u.forEach((x) => taken.add(x));
    picks.push(s);
  }
  if (picks.length === 0) {
    console.error("no stories to render");
    process.exit(1);
  }

  const summary = {
    date: DATE,
    generated_at: new Date().toISOString(),
    picks: picks.map((s, i) => storySummary(s, i + 1)),
    html: HTML_OUT,
    email: EMAIL_OUT,
  };

  writeFileSync(HTML_OUT, renderHtml(DATE, picks));
  writeFileSync(EMAIL_OUT, renderEmail(DATE, picks));
  writeFileSync(JSON_OUT, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({
    date: DATE,
    picks: summary.picks.map((p) => ({
      rank: p.rank,
      id: p.id,
      headline: p.headline.slice(0, 70),
      sources: p.sources,
      score: p.score,
      non_west_pct: p.non_west_pct,
      entropy: p.entropy,
      excerpt_enriched: p.excerpt_enriched,
    })),
    html: HTML_OUT,
    email: EMAIL_OUT,
    json: JSON_OUT,
  }, null, 2));
}

main();
