#!/usr/bin/env bun
/**
 * BotwaveBomba ownership registry builder.
 *
 * Reads api/ownership_seed.json and emits api/ownership.json in the
 * shape story.html expects: { entries: [{ domain, name, owner, owner_type,
 * parent_company, motive, evidence_url, evidence_method, verified_at }] }.
 *
 * Usage:
 *   bun run scripts/build_ownership.ts [--seed api/ownership_seed.json] [--out api/ownership.json]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";

const TODAY = new Date().toISOString().slice(0, 10);

const { values } = parseArgs({
  options: {
    seed: { type: "string", default: "/var/home/gringo/botwave-bomba/api/ownership_seed.json" },
    out: { type: "string", default: "/var/home/gringo/botwave-bomba/api/ownership.json" },
  },
});

const SEED_PATH = values.seed!;
const OUT_PATH = values.out!;

type OwnershipEntry = {
  domain: string;
  name: string;
  owner: string;
  owner_type: string;
  parent_company: string | null;
  motive: string;
  evidence_url: string;
  evidence_method: string;
  verified_at: string;
};

function main() {
  if (!existsSync(SEED_PATH)) {
    console.error(`seed not found: ${SEED_PATH}`);
    process.exit(1);
  }

  const seed = JSON.parse(readFileSync(SEED_PATH, "utf8")) as { entries?: OwnershipEntry[] };
  const entries = (seed.entries || []).filter((e) => e.domain && e.owner);

  const out = {
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    count: entries.length,
    entries,
  };

  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ seed: SEED_PATH, out: OUT_PATH, count: entries.length }, null, 2));
}

main();
