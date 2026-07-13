#!/usr/bin/env bun
/**
 * BotwaveBomba brief index builder.
 *
 * Scans daily/*.json summaries and writes daily/index.json plus
 * daily/index.html (static archive fallback) for static hosting.
 *
 * Usage:
 *   bun run scripts/build_brief_index.ts --out-dir daily
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const TODAY = new Date().toISOString().slice(0, 10);

const { values } = parseArgs({
  options: {
    dir: { type: "string", default: "/var/home/gringo/botwave-bomba/daily" },
    "base-url": { type: "string", default: "/daily/" },
  },
});

const DIR = values.dir!;
const BASE_URL = values["base-url"]!;

type BriefSummary = {
  date: string;
  generated_at?: string;
  picks: {
    rank: number;
    id: string;
    headline: string;
    section: string;
    sources: number;
    score: number;
    non_west_pct: number;
    entropy: number;
    excerpt_enriched: boolean;
  }[];
};

function loadBriefs(dir: string): BriefSummary[] {
  if (!existsSync(dir)) return [];
  const out: BriefSummary[] = [];
  for (const name of readdirSync(dir)) {
    if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) continue;
    const path = join(dir, name);
    try {
      const data = JSON.parse(readFileSync(path, "utf8")) as BriefSummary;
      if (data.date && Array.isArray(data.picks)) out.push(data);
    } catch { /* skip */ }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

function main() {
  const briefs = loadBriefs(DIR);
  if (briefs.length === 0) {
    console.error("no daily/*.json summaries found");
    process.exit(1);
  }

  const latest = briefs[0];
  const index = {
    generated_at: new Date().toISOString(),
    latest: latest.date,
    count: briefs.length,
    briefs: briefs.map((b) => ({
      date: b.date,
      url: `${BASE_URL}${b.date}.html`,
      json_url: `${BASE_URL}${b.date}.json`,
      top_headline: b.picks[0]?.headline || "",
      picks_count: b.picks.length,
      top_score: b.picks[0]?.score ?? 0,
      top_non_west_pct: b.picks[0]?.non_west_pct ?? 0,
      excerpt_enriched: b.picks.some((p) => p.excerpt_enriched),
    })),
  };

  writeFileSync(join(DIR, "index.json"), JSON.stringify(index, null, 2));
  console.log(JSON.stringify({ out: join(DIR, "index.json"), count: index.count, latest: index.latest }, null, 2));
}

main();
