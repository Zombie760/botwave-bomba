#!/usr/bin/env bun
/**
 * BotwaveBomba excerpt-coverage probe.
 *
 * Compares a recent-3-day English slice of the news cache against the excerpt
 * artifact produced by fetch_excerpts.ts and reports what share of the slice
 * now has a lede excerpt.
 *
 * Usage:
 *   bun run scripts/excerpt_coverage.ts \
 *     --cache /path/to/news_cache.jsonl \
 *     --excerpts data/excerpts_YYYY-MM-DD.jsonl \
 *     --days 3 --lang en
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    cache: { type: "string", default: "/var/home/gringo/Botwave-Master-Consolidated/ARMS/bomba-mobile/Book/02_IN_PROGRESS/adriatic-ionian-chokepoint/book_arm/memory/news_cache.jsonl" },
    excerpts: { type: "string", default: "/var/home/gringo/botwave-bomba/data/excerpts_2026-07-13.jsonl" },
    days: { type: "string", default: "3" },
    lang: { type: "string", default: "en" },
  },
});

const CACHE_PATH = values.cache!;
const EXCERPTS_PATH = values.excerpts!;
const DAYS = parseInt(values.days!, 10);
const LANG = values.lang!;

function hash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function main(): void {
  if (!existsSync(CACHE_PATH)) {
    console.error(`cache not found: ${CACHE_PATH}`);
    process.exit(1);
  }

  const excerptHashes = new Set<string>();
  if (existsSync(EXCERPTS_PATH)) {
    for (const line of readFileSync(EXCERPTS_PATH, "utf8").split("\n")) {
      const l = line.trim();
      if (!l) continue;
      try {
        const d = JSON.parse(l);
        if (d.hash && d.excerpt?.length) excerptHashes.add(d.hash);
      } catch { /* skip malformed */ }
    }
  }

  const cutoff = Date.now() - DAYS * 24 * 60 * 60 * 1000;
  let inScope = 0;
  let withExcerpt = 0;

  for (const line of readFileSync(CACHE_PATH, "utf8").split("\n")) {
    const l = line.trim();
    if (!l) continue;
    let d: any;
    try { d = JSON.parse(l); } catch { continue; }
    if (LANG !== "all" && (d.language || "") !== LANG) continue;
    const fa = Date.parse(d.fetched_at || "");
    if (isNaN(fa) || fa < cutoff) continue;
    inScope++;
    const h = d.hash || hash(d.url || "");
    if (excerptHashes.has(h)) withExcerpt++;
  }

  const pct = inScope === 0 ? 0 : +(withExcerpt / inScope * 100).toFixed(2);
  console.log(JSON.stringify({
    cache: CACHE_PATH,
    excerpts: EXCERPTS_PATH,
    days: DAYS,
    lang: LANG,
    in_scope: inScope,
    with_excerpt: withExcerpt,
    coverage_pct: pct,
    target_met: pct >= 25,
  }, null, 2));

  if (pct < 25) process.exit(1);
}

main();
