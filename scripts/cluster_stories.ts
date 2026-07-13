#!/usr/bin/env bun
/**
 * BotwaveBomba story clusterer — the Palantir-method spine.
 *
 * Reads a recent slice of news_cache.jsonl, groups articles into STORIES by
 * headline+description similarity (word-bigram shingle Jaccard + union-find via
 * an inverted index), and writes a structured JSON file where each story carries
 * its 20-30-ish source rows with hyperlink-out, bloc spread, and countries.
 *
 * Pure local transform. No network. No mutation of the cache. Idempotent,
 * hash-derived story ids. See ISA: 2026-07-12_bwb-story-cluster-spine.
 *
 * Usage:
 *   bun run scripts/cluster_stories.ts \
 *     --cache <news_cache.jsonl> --days 3 --lang en \
 *     --min-sources 3 --threshold 0.34 --out api/stories_clustered.json
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";

const DEFAULT_CACHE =
  "/var/home/gringo/Botwave-Master-Consolidated/ARMS/bomba-mobile/Book/02_IN_PROGRESS/adriatic-ionian-chokepoint/book_arm/memory/news_cache.jsonl";
const SOURCES_REGISTRY = "/var/home/gringo/botwave-bomba/api/sources_real_seed.json";

const { values } = parseArgs({
  options: {
    cache: { type: "string", default: DEFAULT_CACHE },
    days: { type: "string", default: "3" },
    lang: { type: "string", default: "en" },
    "min-sources": { type: "string", default: "3" },
    threshold: { type: "string", default: "0.18" },
    "max-size": { type: "string", default: "60" },
    out: { type: "string", default: "/var/home/gringo/botwave-bomba/api/stories_clustered.json" },
    registry: { type: "string", default: SOURCES_REGISTRY },
  },
});

const CACHE_PATH = values.cache!;
const DAYS = parseInt(values.days!, 10);
const LANG = values.lang!; // "all" disables language filter
const MIN_SOURCES = parseInt(values["min-sources"]!, 10);
const THRESHOLD = parseFloat(values.threshold!);
const MAX_SIZE = parseInt(values["max-size"]!, 10);
const OUT_PATH = values.out!;
const REGISTRY_PATH = values.registry!;

const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","to","in","on","for","at","by","with","as","is","are","was",
  "were","be","been","being","this","that","these","those","it","its","from","into","over","after",
  "says","said","say","says","amid","as","us","we","our","their","his","her","they","them","he",
  "she","not","no","yes","more","than","less","new","one","two","will","has","have","had","do","does",
  "did","can","could","may","might","must","should","would","about","above","below","up","down","out",
]);

// --- bloc heuristics (placeholder until the ownership/motive registry slice ships) ---
const ADVERSARIAL_COUNTRIES = new Set(["IR","CN","RU","SY","KP","BY"]);
const WESTERN_COUNTRIES = new Set(["US","GB","CA","AU","NZ","IL","DE","FR","IT","ES","NL","BE","PT","IE","SE","NO","DK","FI","IS","LU","AT","CH","GR","PL","CZ","SK","HU","RO","BG","HR","SI","EE","LV","LT","MT","CY"]);

type Article = {
  hash: string;
  headline: string;
  url: string;
  description: string;
  fetched_at: string;
  source: string;
  source_name: string;
  country: string;
  language: string;
  categories: string | string[] | null;
  full_text: string | null;
};

type SourceRow = {
  name: string;
  bloc: string;
  country: string;
  url: string;
  excerpt: string;
  framing_placeholder: null;
};

type Story = {
  id: string;
  size: number;
  source_count: number;
  bloc_spread: { western: number; non_aligned: number; adversarial: number };
  bloc_source: string;
  countries: string[];
  top_headlines: string[];
  primary_urls: string[];
  sources: SourceRow[];
};

function normalize(text: string): string[] {
  return (text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function shingles(tokens: string[]): Set<string> {
  // unigrams (entity-driven "same story" signal) + bigrams (phrase overlap)
  const s = new Set<string>();
  for (const t of tokens) s.add(t);
  for (let i = 0; i < tokens.length - 1; i++) s.add(tokens[i] + " " + tokens[i + 1]);
  return s;
}

function bigramsOf(tokens: string[]): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) s.add(tokens[i] + " " + tokens[i + 1]);
  return s;
}

function sharePhrase(a: Set<string>, b: Set<string>): boolean {
  // two stories are only the "same story" if they share a phrase (bigram);
  // a lone shared common unigram ("dies", "former") must NOT merge two deaths.
  for (const x of a) if (b.has(x)) return true;
  return false;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (large.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// union-find with size cap — refuses unions that would exceed MAX_SIZE, killing the
// transitive-chaining monsters that news-"Wrap"/roundup aggregator articles create.
class UF {
  parent: number[];
  sz: number[];
  maxSize: number;
  constructor(n: number, maxSize: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.sz = new Array(n).fill(1);
    this.maxSize = maxSize;
  }
  find(x: number): number {
    while (this.parent[x] !== x) { this.parent[x] = this.parent[this.parent[x]]; x = this.parent[x]; }
    return x;
  }
  union(a: number, b: number): boolean {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return false;
    if (this.sz[ra] + this.sz[rb] > this.maxSize) return false; // cap chaining
    if (this.sz[ra] < this.sz[rb]) { this.parent[ra] = rb; this.sz[rb] += this.sz[ra]; }
    else { this.parent[rb] = ra; this.sz[ra] += this.sz[rb]; }
    return true;
  }
}

const AGGREGATOR_RE = /\b(news wrap|wrap:|wrap\b|roundup|round-up|morning brief|evening brief|news digest|top stories|news update|news headlines|daily brief|news bulletin|evening news wrap|news review)\b/i;

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function loadRegistry(path: string): Map<string, { bloc: string }> {
  const map = new Map<string, { bloc: string }>();
  if (!existsSync(path)) return map;
  try {
    const arr = JSON.parse(readFileSync(path, "utf8")) as any[];
    for (const s of arr) if (s?.domain && s?.bloc) map.set(s.domain, { bloc: s.bloc });
  } catch { /* registry optional */ }
  return map;
}

function blocFor(a: Article, registry: Map<string, { bloc: string }>): { bloc: string; source: string } {
  const dom = domainOf(a.url);
  const r = dom ? registry.get(dom) : undefined;
  if (r?.bloc) return { bloc: r.bloc, source: "registry" };
  // country heuristic fallback
  const c = (a.country || "").toUpperCase();
  let bloc = "non_aligned";
  if (ADVERSARIAL_COUNTRIES.has(c)) bloc = "adversarial";
  else if (WESTERN_COUNTRIES.has(c)) bloc = "western";
  return { bloc, source: "heuristic" };
}

function main() {
  if (!existsSync(CACHE_PATH)) {
    console.error(`cache not found: ${CACHE_PATH}`);
    process.exit(1);
  }
  const cacheMtime = statSync(CACHE_PATH).mtimeMs;
  const registry = loadRegistry(REGISTRY_PATH);

  const cutoff = Date.now() - DAYS * 24 * 60 * 60 * 1000;
  const articles: Article[] = [];
  const raw = readFileSync(CACHE_PATH, "utf8").split("\n");
  for (const line of raw) {
    const l = line.trim();
    if (!l) continue;
    let d: any;
    try { d = JSON.parse(l); } catch { continue; }
    const fa = Date.parse(d.fetched_at || "");
    if (isNaN(fa) || fa < cutoff) continue;
    if (LANG !== "all" && (d.language || "") !== LANG) continue;
    if (AGGREGATOR_RE.test(d.headline || "")) continue; // skip roundup/wrap bridges
    articles.push({
      hash: d.hash || createHash("sha256").update(d.url || d.headline || "").digest("hex").slice(0, 16),
      headline: d.headline || "",
      url: d.url || "",
      description: d.description || "",
      fetched_at: d.fetched_at || "",
      source: d.source || "",
      source_name: d.source_name || d.source || "",
      country: d.country || "",
      language: d.language || "",
      categories: d.categories ?? null,
      full_text: d.full_text ?? null,
    });
  }

  const inCount = articles.length;
  if (inCount === 0) {
    writeFileSync(OUT_PATH, JSON.stringify({ generated_at: new Date().toISOString(), in_count: 0, clustered_count: 0, unclustered: 0, stories_count: 0, stories: [] }, null, 2));
    console.log(JSON.stringify({ in_count: 0, clustered_count: 0, unclustered: 0, stories_count: 0 }));
    process.exit(0);
  }

  // shingles per article (unigrams+bigrams for Jaccard) and bigram-only sets for the phrase gate
  const shing: Set<string>[] = articles.map((a) => shingles(normalize(`${a.headline} ${a.description}`)));
  const bigr: Set<string>[] = articles.map((a) => bigramsOf(normalize(`${a.headline} ${a.description}`)));

  // inverted index over BIGRAMS only — candidate pairs already share a phrase by construction,
  // with a doc-frequency cap to prune common-phrase bigrams ("says in", "to be").
  const inverted = new Map<string, number[]>();
  const MAX_DOC_FREQ = Math.max(20, Math.floor(articles.length * 0.05));
  const df = new Map<string, number>();
  for (let i = 0; i < articles.length; i++) {
    for (const sh of bigr[i]) df.set(sh, (df.get(sh) || 0) + 1);
  }
  for (let i = 0; i < articles.length; i++) {
    for (const sh of bigr[i]) {
      if (df.get(sh)! > MAX_DOC_FREQ) continue; // skip too-common bigrams
      const arr = inverted.get(sh);
      if (arr) arr.push(i); else inverted.set(sh, [i]);
    }
  }

  // candidate pairs via shared shingle, then full Jaccard
  const uf = new UF(articles.length, MAX_SIZE);
  for (const [, idxs] of inverted) {
    for (let i = 0; i < idxs.length; i++) {
      for (let j = i + 1; j < idxs.length; j++) {
        const a = idxs[i], b = idxs[j];
        if (uf.find(a) === uf.find(b)) continue;
        if (jaccard(shing[a], shing[b]) >= THRESHOLD && sharePhrase(bigr[a], bigr[b])) uf.union(a, b);
      }
    }
  }

  // group into clusters
  const clusters = new Map<number, number[]>();
  for (let i = 0; i < articles.length; i++) {
    const root = uf.find(i);
    const arr = clusters.get(root);
    if (arr) arr.push(i); else clusters.set(root, [i]);
  }

  const seenUrl = new Set<string>();
  const stories: Story[] = [];
  let clusteredCount = 0;
  for (const idxs of clusters.values()) {
    if (idxs.length < 2) continue; // singletons aren't "stories" yet
    clusteredCount += idxs.length;
    const members = idxs.map((i) => articles[i]);
    // unique by url
    const byUrl = new Map<string, Article>();
    for (const m of members) if (m.url && !byUrl.has(m.url)) byUrl.set(m.url, m);
    const unique = [...byUrl.values()];
    const sourceNames = new Set(unique.map((m) => m.source_name));
    if (sourceNames.size < MIN_SOURCES) continue;

    const blocSpread = { western: 0, non_aligned: 0, adversarial: 0 };
    const countries = new Set<string>();
    const blocSources = new Set<string>();
    const rows: SourceRow[] = [];
    for (const m of unique) {
      const { bloc, source } = blocFor(m, registry);
      blocSources.add(source);
      if (bloc === "western") blocSpread.western++;
      else if (bloc === "adversarial") blocSpread.adversarial++;
      else blocSpread.non_aligned++;
      if (m.country) countries.add(m.country.toUpperCase());
      rows.push({
        name: m.source_name,
        bloc,
        country: (m.country || "").toUpperCase(),
        url: m.url,
        excerpt: (m.description || "").slice(0, 280),
        framing_placeholder: null,
      });
    }

    const headlines: string[] = [];
    for (const m of unique) { if (m.headline && headlines.length < 5) headlines.push(m.headline); }

    stories.push({
      id: createHash("sha256").update(unique.map((m) => m.hash).sort().join("|")).digest("hex").slice(0, 16),
      size: unique.length,
      source_count: sourceNames.size,
      bloc_spread: blocSpread,
      bloc_source: [...blocSources].sort().join(","),
      countries: [...countries].sort(),
      top_headlines: headlines,
      primary_urls: unique.slice(0, 5).map((m) => m.url).filter(Boolean),
      sources: rows.sort((x, y) => x.name.localeCompare(y.name)),
    });
  }

  stories.sort((a, b) => b.source_count - a.source_count);
  const unclustered = inCount - clusteredCount;
  const out = {
    generated_at: new Date().toISOString(),
    in_count: inCount,
    clustered_count: clusteredCount,
    unclustered,
    stories_count: stories.length,
    stories,
  };
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

  // safety: never mutated the cache
  if (statSync(CACHE_PATH).mtimeMs !== cacheMtime) {
    console.error("FATAL: cache mtime changed — aborting (read-only invariant violated)");
    process.exit(1);
  }

  console.log(JSON.stringify({
    in_count: inCount,
    clustered_count: clusteredCount,
    unclustered,
    stories_count: stories.length,
    top_story_sources: stories.slice(0, 5).map((s) => s.source_count),
    invariant_ok: inCount === clusteredCount + unclustered,
  }));
}

main();