#!/usr/bin/env bun
/**
 * BotwaveBomba daily pipeline runner.
 *
 * Orchestrates the deterministic daily flow:
 *   1. cluster_stories.ts — cluster the recent cache
 *   2. fetch_excerpts.ts — fetch body excerpts (prioritizing top stories)
 *   3. render_brief.ts — render daily HTML / email / JSON
 *   4. build_brief_index.ts — update daily/index.json
 *   5. build_ownership.ts — rebuild ownership.json from seed
 *
 * Usage:
 *   bun run scripts/run_pipeline.ts [--date 2026-07-13] [--skip-fetch]
 *
 * Each step is a separate subprocess so failures are isolated and logs are clean.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";

const TODAY = new Date().toISOString().slice(0, 10);

const { values } = parseArgs({
  options: {
    date: { type: "string", default: TODAY },
    "skip-fetch": { type: "boolean", default: false },
    "max-articles": { type: "string", default: "4000" },
    "requests-per-minute": { type: "string", default: "90" },
  },
});

const DATE = values.date!;
const SKIP_FETCH = values["skip-fetch"];
const MAX_ARTICLES = values["max-articles"]!;
const RPM = values["requests-per-minute"]!;

const ROOT = "/var/home/gringo/botwave-bomba";
const CACHE = "/var/home/gringo/Botwave-Master-Consolidated/ARMS/bomba-mobile/Book/02_IN_PROGRESS/adriatic-ionian-chokepoint/book_arm/memory/news_cache.jsonl";

function run(label: string, script: string, args: string[]): { ok: boolean; out: string; err: string } {
  const start = Date.now();
  const child = spawnSync("bun", ["run", script, ...args], { cwd: ROOT, encoding: "utf8", timeout: 1200000 });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const ok = child.status === 0;
  const out = child.stdout || "";
  const err = child.stderr || "";
  console.log(`\n─── ${label} (${elapsed}s) ${ok ? "OK" : "FAIL"} ───`);
  if (out.trim()) console.log(out.trim());
  if (!ok && err.trim()) console.error(err.trim());
  return { ok, out, err };
}

function main() {
  console.log(`🚀 BotwaveBomba pipeline · date=${DATE}`);

  if (!existsSync(CACHE)) {
    console.error(`cache not found: ${CACHE}`);
    process.exit(1);
  }

  const steps: { label: string; script: string; args: string[]; skip?: boolean }[] = [
    { label: "Cluster stories", script: "scripts/cluster_stories.ts", args: [] },
    { label: "Fetch excerpts", script: "scripts/fetch_excerpts.ts", args: ["--cache", CACHE, "--out", `data/excerpts_${DATE}.jsonl`, "--stories", "api/stories_clustered.json", "--top-stories", "10", "--max-articles", MAX_ARTICLES, "--requests-per-minute", RPM, "--max-failures", "1500"], skip: SKIP_FETCH },
    { label: "Render brief", script: "scripts/render_brief.ts", args: ["--date", DATE] },
    { label: "Build brief index", script: "scripts/build_brief_index.ts", args: [] },
    { label: "Build ownership registry", script: "scripts/build_ownership.ts", args: [] },
  ];

  for (const step of steps) {
    if (step.skip) {
      console.log(`\n─── ${step.label} SKIPPED ───`);
      continue;
    }
    const r = run(step.label, step.script, step.args);
    if (!r.ok) {
      console.error(`\nPipeline halted at ${step.label}`);
      process.exit(1);
    }
  }

  console.log("\n✅ Pipeline complete");
  console.log(`   daily/${DATE}.html`);
  console.log(`   daily/${DATE}.json`);
  console.log(`   email/${DATE}.txt`);
  console.log(`   daily/index.json`);
  console.log(`   api/ownership.json`);
}

main();
