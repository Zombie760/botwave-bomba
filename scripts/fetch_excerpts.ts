#!/usr/bin/env bun
/**
 * BotwaveBomba bounded body-excerpt fetcher.
 *
 * Reads a jsonl article cache, selects the recent N-day slice for a given language,
 * skips entries that already carry full_text, and fetches the article URL to produce
 * a fair-use lede excerpt. Uses Mozilla Readability for article-body extraction.
 * Output is a separate JSONL artifact; the input cache is never modified.
 *
 * Usage:
 *   bun run scripts/fetch_excerpts.ts \
 *     --cache /path/to/news_cache.jsonl \
 *     --days 3 --lang en --max-articles 3000 \
 *     --out data/excerpts_YYYY-MM-DD.jsonl \
 *     --requests-per-minute 30
 */
import { readFileSync, writeFileSync, existsSync, statSync, appendFileSync } from "node:fs";
import { createHash as cryptoCreateHash } from "node:crypto";
import { parseArgs } from "node:util";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const TODAY = new Date().toISOString().slice(0, 10);

const { values } = parseArgs({
  options: {
    cache: { type: "string", default: "/var/home/gringo/Botwave-Master-Consolidated/ARMS/bomba-mobile/Book/02_IN_PROGRESS/adriatic-ionian-chokepoint/book_arm/memory/news_cache.jsonl" },
    days: { type: "string", default: "3" },
    lang: { type: "string", default: "en" },
    "max-articles": { type: "string", default: "3000" },
    "max-chars": { type: "string", default: "600" },
    "min-body-chars": { type: "string", default: "80" },
    "requests-per-minute": { type: "string", default: "30" },
    "timeout-ms": { type: "string", default: "15000" },
    out: { type: "string", default: `/var/home/gringo/botwave-bomba/data/excerpts_${TODAY}.jsonl` },
    "max-failures": { type: "string", default: "500" },
    stories: { type: "string", default: "" },
    "top-stories": { type: "string", default: "0" },
  },
});

const CACHE_PATH = values.cache!;
const DAYS = parseInt(values.days!, 10);
const LANG = values.lang!;
const LIMIT = parseInt(values["max-articles"]!, 10);
const MAX_CHARS = parseInt(values["max-chars"]!, 10);
const MIN_BODY_CHARS = parseInt(values["min-body-chars"]!, 10);
const RPM = parseInt(values["requests-per-minute"]!, 10);
const TIMEOUT_MS = parseInt(values["timeout-ms"]!, 10);
const OUT_PATH = values.out!;
const MAX_FAILURES = parseInt(values["max-failures"]!, 10);
const STORIES_PATH = values.stories!;
const TOP_STORIES = parseInt(values["top-stories"]!, 10);

const CONCURRENCY = 4;
const DELAY_MS = Math.max(1, Math.ceil((CONCURRENCY * 60000) / RPM));

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
];

type CacheArticle = {
  hash?: string;
  url?: string;
  headline?: string;
  description?: string;
  source_name?: string;
  source?: string;
  fetched_at?: string;
  language?: string;
  country?: string;
  full_text?: string | null;
};

type ExcerptRow = {
  hash: string;
  url: string;
  source_name: string;
  source_domain: string;
  headline: string;
  published_at?: string;
  excerpt: string;
  excerpt_source: "readability" | "meta" | "description";
  status_code: number;
  fetched_at: string;
  error?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeUrl(u: string): string {
  return u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function extractMetaDescription(html: string): string {
  const m = html.match(/<meta[^>]*(?:name=["']description["'][^>]*content=["']([^"']+)["']|content=["']([^"']+)["'][^>]*name=["']description["']|property=["']og:description["'][^>]*content=["']([^"']+)["'])[^>]*>/i);
  return m?.[1] || m?.[2] || m?.[3] || "";
}

function extractExcerpt(text: string): string {
  text = text.replace(/\s+/g, " ").trim();
  if (text.length <= MAX_CHARS) return text;
  const prefix = text.slice(0, MAX_CHARS);
  // Find the last sentence boundary in the prefix; prefer ending cleanly.
  const ends: number[] = [];
  const re = /\.[\s\"'’”]|\.$/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(prefix)) !== null) {
    ends.push(mm.index + 1); // include the period
  }
  for (let i = ends.length - 1; i >= 0; i--) {
    const cut = ends[i];
    if (cut >= MIN_BODY_CHARS) return prefix.slice(0, cut).trim();
  }
  return prefix.trim();
}

function looksBlocked(status: number, text: string): boolean {
  if (status === 403 || status === 429 || status === 503) return true;
  const blockers = [
    /cloudflare/i, /captcha/i, /are you human/i, /access denied/i, /blocked/i,
    /permission denied/i, /incapsula/i, /akamai/i, /pardon our interruption/i,
    /please enable javascript/i,
  ];
  return blockers.some((re) => re.test(text));
}

async function fetchExcerpt(article: CacheArticle, index: number): Promise<ExcerptRow | null> {
  const url = article.url!;
  const hash = article.hash || createHash(url);
  const source_domain = domainOf(url);
  const ua = USER_AGENTS[index % USER_AGENTS.length];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let status = 0;
  let body = "";
  let error = "";

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
      },
    });
    clearTimeout(timeout);
    status = res.status;
    body = await res.text();
  } catch (e: any) {
    clearTimeout(timeout);
    error = e?.name === "AbortError" ? "timeout" : String(e?.message || e);
  }

  const blocked = looksBlocked(status, body);
  const meta = extractMetaDescription(body);
  const desc = (article.description || "").trim();

  function successRow(excerpt: string, source: "readability" | "meta" | "description"): ExcerptRow {
    return {
      hash,
      url,
      source_name: article.source_name || article.source || "",
      source_domain,
      headline: article.headline || "",
      published_at: article.fetched_at,
      excerpt: extractExcerpt(excerpt),
      excerpt_source: source,
      status_code: status,
      fetched_at: new Date().toISOString(),
    };
  }

  if (status >= 200 && status < 300 && !blocked) {
    try {
      const dom = new JSDOM(body, { url });
      const readerable = new Readability(dom.window.document, { charThreshold: MIN_BODY_CHARS }).parse();
      if (readerable?.textContent && readerable.textContent.length >= MIN_BODY_CHARS) {
        return successRow(readerable.textContent, "readability");
      }
    } catch {
      // Readability failed; fall through to meta/description.
    }
    if (meta.length >= MIN_BODY_CHARS) return successRow(meta, "meta");
    if (desc.length >= MIN_BODY_CHARS) return successRow(desc, "description");
  }

  if (blocked && !error) error = `blocked_or_bot_detected (${status})`;
  if (!error) error = status >= 400 ? `http_${status}` : `body_too_short`;

  return {
    hash,
    url,
    source_name: article.source_name || article.source || "",
    source_domain,
    headline: article.headline || "",
    published_at: article.fetched_at,
    excerpt: "",
    excerpt_source: "readability",
    status_code: status,
    fetched_at: new Date().toISOString(),
    error,
  };
}

function createHash(input: string): string {
  return cryptoCreateHash("sha256").update(input).digest("hex").slice(0, 16);
}

async function main(): Promise<void> {
  if (!existsSync(CACHE_PATH)) {
    console.error(`cache not found: ${CACHE_PATH}`);
    process.exit(1);
  }

  const cacheMtime = statSync(CACHE_PATH).mtimeMs;
  const cutoff = Date.now() - DAYS * 24 * 60 * 60 * 1000;

  const doneHashes = new Set<string>();
  if (existsSync(OUT_PATH)) {
    for (const line of readFileSync(OUT_PATH, "utf8").split("\n")) {
      const l = line.trim();
      if (!l) continue;
      try {
        const d = JSON.parse(l);
        if (d.hash) doneHashes.add(d.hash);
      } catch { /* skip */ }
    }
  } else {
    writeFileSync(OUT_PATH, "");
  }

  const targets: CacheArticle[] = [];
  const seenUrls = new Set<string>();

  for (const line of readFileSync(CACHE_PATH, "utf8").split("\n")) {
    const l = line.trim();
    if (!l) continue;
    let d: CacheArticle;
    try { d = JSON.parse(l); } catch { continue; }
    if (LANG !== "all" && (d.language || "") !== LANG) continue;
    const fa = Date.parse(d.fetched_at || "");
    if (isNaN(fa) || fa < cutoff) continue;
    const ft = (d.full_text || "").trim();
    if (ft.length > MIN_BODY_CHARS) continue;
    const url = (d.url || "").trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const key = normalizeUrl(url);
    if (seenUrls.has(key)) continue;
    const hash = d.hash || createHash(url);
    if (doneHashes.has(hash)) continue;
    seenUrls.add(key);
    targets.push(d);
    if (targets.length >= LIMIT) break;
  }

  if (STORIES_PATH && TOP_STORIES > 0 && existsSync(STORIES_PATH)) {
    try {
      const stories = JSON.parse(readFileSync(STORIES_PATH, "utf8"))?.stories || [];
      const topIds = new Set<string>();
      for (const s of stories.slice(0, TOP_STORIES)) {
        for (const u of s.primary_urls || []) topIds.add(normalizeUrl(u));
      }
      if (topIds.size > 0) {
        targets.sort((a, b) => {
          const pa = topIds.has(normalizeUrl(a.url || "")) ? 1 : 0;
          const pb = topIds.has(normalizeUrl(b.url || "")) ? 1 : 0;
          return pb - pa;
        });
      }
    } catch { /* optional; continue with original order */ }
  }

  if (targets.length === 0) {
    console.log(JSON.stringify({ resumed: doneHashes.size, in_scope: 0, fetched: doneHashes.size, success: doneHashes.size, failed: 0, coverage_pct: 0, out: OUT_PATH }, null, 2));
    return;
  }

  let attempted = 0;
  let success = 0;
  let consecutiveFailures = 0;
  let failureStops = 0;

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map((a, idx) => fetchExcerpt(a, i + idx)));

    for (const r of batchResults) {
      if (!r) continue;
      attempted++;
      appendFileSync(OUT_PATH, JSON.stringify(r) + "\n");
      if (r.excerpt) {
        success++;
        consecutiveFailures = 0;
      } else {
        consecutiveFailures++;
      }
    }

    if (consecutiveFailures >= MAX_FAILURES) {
      console.error(`ERROR: ${consecutiveFailures} consecutive failures; stopping to avoid hammering`);
      failureStops = consecutiveFailures;
      break;
    }
    if (i + CONCURRENCY < targets.length) await sleep(DELAY_MS);
  }

  if (statSync(CACHE_PATH).mtimeMs !== cacheMtime) {
    console.error("FATAL: cache mtime changed — aborting (read-only invariant violated)");
    process.exit(1);
  }

  const totalFetched = doneHashes.size + attempted;
  console.log(JSON.stringify({
    resumed: doneHashes.size,
    in_scope: targets.length + doneHashes.size,
    attempted,
    success,
    failed: attempted - success,
    consecutive_failure_stop: failureStops,
    total_in_output: totalFetched,
    coverage_pct: +(success / targets.length * 100).toFixed(2),
    out: OUT_PATH,
    cache_invariant_ok: true,
  }, null, 2));

  if (success / targets.length < 0.25) {
    console.error(`WARNING: excerpt coverage ${(success / targets.length * 100).toFixed(1)}% below 25% target`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
