// BotwaveBomba data pipeline — reads canonical API JSON and exports typed helpers
export interface Asset {
  name: string;
  alignment: string;
  country: string;
  url: string;
  excerpt?: string;
  framing_placeholder?: string | null;
  // Backward-compatible aliases
  bloc?: string;
  bias?: string;
  factuality?: string;
  owner?: string;
  // Tradecraft fields
  lean?: "left" | "center" | "right";
  vetting?: "high" | "mixed" | "low";
  tone?: "neutral" | "sensationalist" | "opinion";
  funding?: string;
  independence?: string;
  paywall?: string;
  language?: string;
  handler?: string;
}

export interface SigintPackage {
  id: string;
  size: number;
  assetCount: number;
  alignmentSpread: Record<string, number>;
  alignmentSource: string;
  theaters: string[];
  topHeadlines: string[];
  sources: Asset[];
  lastUpdated?: string;
  // Backward-compatible aliases for legacy JSON and modules
  source_count?: number;
  bloc_spread?: Record<string, number>;
  bloc_source?: string;
  countries?: string[];
  top_headlines?: string[];
  refraction?: Record<string, string>;
  // Chronos support
  firstSeen?: string;
  peakCoverage?: string;
}

export interface MoneyTrailLink {
  domain: string;
  handler?: string;
  parentCompany?: string;
  handlerType?: string;
  motive?: string;
  evidenceUrl?: string;
  // Backward-compatible alias
  parent_company?: string;
  owner?: string;
}

export interface Meta {
  generatedAt: string;
  generated_at?: string;
  sigintCount: number;
  story_count?: number;
  assetCountTotal: number;
  source_count_total?: number;
  assetRegistryCount: number;
  source_registry_count?: number;
  theaterCount: number;
  country_count?: number;
  alignmentSpread: Record<string, number>;
  bloc_spread?: Record<string, number>;
  diversityScore: number;
  diversity_score?: number;
  silentSectorHeadline: string;
  coverage_gap_headline?: string;
  pages?: string[];
  section_count?: number;
}

// Tradecraft: Black Site intel
export interface BlackSiteIntel extends SigintPackage {
  silentSector: string;
  coverageRatio: number;
  // Backward-compatible alias for build_site.ts
  sigintPackage?: SigintPackage;
}

// Tradecraft: Active frequency for personalization
export interface ActiveFrequency {
  id: string;
  label: string;
  sigintIds: string[];
  monitorCount?: number;
}

// Tradecraft: Numbers Station broadcast
export interface NumbersStationBroadcast {
  id: string;
  date: string;
  title: string;
  sigintIds: string[];
  readTimeMin: number;
}

// Tradecraft: Radar contact
export interface RadarContact {
  theater: string;
  alignment: string;
  signalCount: number;
  assetCount: number;
}

// Tradecraft: Chronos frame
export interface ChronosFrame {
  date: string; // ISO date string
  sigintId: string;
  headline: string;
  assetCount: number;
  alignmentSpread: Record<string, number>;
  theaters: string[];
  newAssets: string[];
}

import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";

const ROOT = process.env.BOTWAVE_ROOT || new URL("../..", import.meta.url).pathname.slice(0, -1);

function readJson<T>(filePath: string, fallback?: T): T {
  const full = path.resolve(ROOT, filePath);
  if (!existsSync(full)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing data file: ${full}`);
  }
  return JSON.parse(readFileSync(full, "utf8")) as T;
}

// Normalize legacy JSON field names (bloc_spread / countries / non_aligned)
// to the canonical SigintPackage schema. The data on disk uses an older
// naming scheme; this keeps every consumer in build_site.ts working without
// having to know which schema is on disk.
function normalizePackage(raw: any): SigintPackage {
  const sources: Asset[] = (raw.sources || []).map((s: any) => ({
    ...s,
    alignment: (s.alignment || s.bloc || "other").toString().toLowerCase().replace(/_/g, "-"),
    bloc: s.bloc || s.alignment,
  }));

  // Derive theaters from sources (unique country set) when countries[] is missing or sparse.
  const fromSources = Array.from(new Set(sources.map((s) => s.country).filter(Boolean)));
  const theaters: string[] =
    raw.theaters && raw.theaters.length
      ? raw.theaters
      : raw.countries && raw.countries.length
        ? raw.countries
        : fromSources;

  // Translate bloc_spread (western / non_aligned / adversarial / other) -> hyphenated keys.
  const blocSpread: Record<string, number> = raw.bloc_spread || {};
  const alignmentSpread: Record<string, number> = {
    ...(raw.alignmentSpread || {}),
  };
  for (const [k, v] of Object.entries(blocSpread)) {
    const key = k.toLowerCase().replace(/_/g, "-");
    alignmentSpread[key] = (alignmentSpread[key] || 0) + Number(v || 0);
  }
  // If neither spread had anything, count from sources.
  if (Object.values(alignmentSpread).every((v) => !v)) {
    for (const src of sources) {
      const k = src.alignment || "other";
      alignmentSpread[k] = (alignmentSpread[k] || 0) + 1;
    }
  }

  return {
    ...raw,
    id: String(raw.id),
    size: raw.size ?? sources.length,
    assetCount: raw.assetCount ?? raw.source_count ?? sources.length,
    sources,
    theaters,
    countries: raw.countries || theaters,
    alignmentSpread,
    alignmentSource: raw.alignmentSource || raw.bloc_source || "derived",
    topHeadlines: raw.topHeadlines || raw.top_headlines || [],
    lastUpdated: raw.lastUpdated || raw.generated_at || raw.firstSeen,
  };
}

export function getSigintPackages(): SigintPackage[] {
  // Try canonical name first, then legacy clustered file
  let data: { stories?: any[] } | null = null;
  try {
    data = readJson<{ stories?: any[] }>("api/sigint-packages.json");
  } catch {
    data = readJson<{ stories?: any[] }>("api/stories_clustered.json");
  }
  return (data?.stories || []).map(normalizePackage);
}

export function getAssets(): Asset[] {
  const data = readJson<{ sources?: Asset[] }>("api/asset-registry.json", { sources: [] });
  if (data.sources?.length) return data.sources;
  // Fallback: derive unique assets from clustered stories
  const stories = getSigintPackages();
  const map = new Map<string, Asset>();
  for (const pkg of stories) {
    for (const src of pkg.sources || []) {
      const key = `${src.name}|${src.country}`;
      if (!map.has(key)) map.set(key, src);
    }
  }
  return Array.from(map.values());
}

export function getMoneyTrail(): MoneyTrailLink[] {
  const data = readJson<{ entries?: MoneyTrailLink[] }>("api/money-trail.json", { entries: [] });
  if (data.entries?.length) return data.entries;
  // Fallback: derive ownership trail from sources if available
  const sources = getAssets();
  return sources
    .filter((s) => s.owner || s.handler)
    .map((s) => ({
      domain: s.name,
      handler: s.handler || s.owner,
      handlerType: "owner",
      motive: s.funding || "commercial",
      evidenceUrl: s.url,
    }));
}

export function getMeta(): Meta {
  return readJson<Meta>("api/meta.json", {
    generatedAt: new Date().toISOString(),
    sigintCount: 0,
    assetCountTotal: 0,
    assetRegistryCount: 0,
    theaterCount: 0,
    alignmentSpread: { western: 0, "non-aligned": 0, adversarial: 0 },
    diversityScore: 0,
    silentSectorHeadline: "Live coverage summary loading.",
  });
}

export function getErrata() {
  return readJson<{ corrections?: any[] }>("api/errata.json", { corrections: [] });
}

// === Watch (Stage 4 — Epstein Watch, accountability tracker) ===
export type WatchStatus =
  | "arrested" | "charged" | "convicted" | "settled" | "civil_suit"
  | "cooperating" | "no_action" | "cleared" | "deceased" | "unknown";

export interface WatchEntity {
  entity_id: string;
  name: string;
  person_type: string;
  occupation: string;
  ds10_mention_count: number;
  status: WatchStatus;
  summary: string;
  sources: { name: string; url: string }[];
  last_updated: string;
}

export interface WatchStatusFile {
  generated_at: string;
  methodology: string;
  entity_count: number;
  status_counts: Partial<Record<WatchStatus, number>>;
  group_counts: Record<string, number>;
  sources_used: { name: string; url: string }[];
  groups: Record<string, WatchEntity[]>;
  all: WatchEntity[];
}

export function getWatchStatus(): WatchStatusFile {
  return readJson<WatchStatusFile>("api/watch-status.json", {
    generated_at: new Date(0).toISOString(),
    methodology: "watch-status.json missing — run scripts/build_watch_status.py",
    entity_count: 0,
    status_counts: {},
    group_counts: {},
    sources_used: [],
    groups: {},
    all: [],
  });
}

export interface IntelligenceEntry {
  bates: string;
  year: number | null;
  classification: string;
  cycle_layer: string;
  classes: string[];
  entities: string[];
  actors: string[];
  excerpt: string;
}

export interface Intelligence {
  generated_at: string;
  source_corpus: string;
  method?: string;
  corpus_stats: {
    total_docs: number;
    ocr_processed: number;
    hand_tagged_actor_docs: number;
    entries_with_body_hits: number;
  };
  class_of_2025?: {
    headline: string;
    summary: string;
    members: Array<{ name: string; role: string; receipt: string; block: string }>;
  };
  trump_orbit?: {
    headline: string;
    summary: string;
    members: Array<{ name: string; receipt: string; tier: string }>;
  };
  donor_class?: {
    headline: string;
    summary: string;
    members: Array<{ name: string; amount?: string; receipt: string; tier: string }>;
  };
  models_reference?: {
    title: string;
    items: Array<{ name: string; note: string; format?: string; download?: string }>;
    note: string;
  };
  mechanism: {
    claim: string;
    principle: string;
    cycle: string[];
  };
  book_reference: {
    title: string;
    author: string;
    year: number;
    path: string;
    chapters: string[];
  };
  corkboard_reference: {
    title: string;
    path: string;
    description: string;
    aesthetic: string;
  };
  moat_framing: {
    first_ep_chain: Array<{ year: number; event: string; mechanism: string }>;
  };
  scanner_stats: Record<string, Record<string, number>>;
  cooccurrence: Array<{ a: string; b: string; count: number }>;
  spotlight: IntelligenceEntry[];
  entries: IntelligenceEntry[];
}

export function getIntelligence(): Intelligence {
  return readJson<Intelligence>("api/intelligence.json", {
    generated_at: new Date().toISOString(),
    source_corpus: "EFTA corpus (fallback: empty)",
    method: "",
    corpus_stats: { total_docs: 0, ocr_processed: 0, hand_tagged_actor_docs: 0, entries_with_body_hits: 0 },
    class_of_2025: { headline: "", summary: "", members: [] },
    trump_orbit: { headline: "", summary: "", members: [] },
    donor_class: { headline: "", summary: "", members: [] },
    models_reference: { title: "", items: [], note: "" },
    mechanism: { claim: "", principle: "", cycle: [] },
    book_reference: { title: "", author: "", year: 0, path: "", chapters: [] },
    corkboard_reference: { title: "", path: "", description: "", aesthetic: "" },
    moat_framing: { first_ep_chain: [] },
    scanner_stats: {},
    cooccurrence: [],
    spotlight: [],
    entries: [],
  });
}

export function getMoneyTrailByDomain(): Record<string, MoneyTrailLink> {
  const list = getMoneyTrail();
  const map: Record<string, MoneyTrailLink> = {};
  for (const entry of list) {
    if (entry?.domain) map[entry.domain] = entry;
  }
  return map;
}

interface OwnershipEntry {
  domain: string;
  name: string;
  owner: string;
  owner_type: string;
  parent_company?: string | null;
  motive: string;
  evidence_url: string;
  evidence_method?: string;
  verified_at?: string;
}

let _ownershipCache: Record<string, OwnershipEntry> | null = null;
export function getOwnership(): Record<string, OwnershipEntry> {
  if (_ownershipCache) return _ownershipCache;
  const data = readJson<{ entries?: OwnershipEntry[] }>("api/ownership.json", { entries: [] });
  const map: Record<string, OwnershipEntry> = {};
  for (const e of data.entries || []) {
    if (e?.domain) map[e.domain] = e;
  }
  _ownershipCache = map;
  return map;
}

export function extractDomain(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    let host = u.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host;
  } catch {
    return null;
  }
}

export function resolveOwnershipForSource(url: string): OwnershipEntry | null {
  const domain = extractDomain(url);
  if (!domain) return null;
  const own = getOwnership();
  // Exact match
  if (own[domain]) return own[domain];
  // Try stripping common subdomains (e.g. "m.aljazeera.com" → "aljazeera.com")
  const parts = domain.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join(".");
    if (own[candidate]) return own[candidate];
  }
  return null;
}

export function normAlignment(alignment?: string): string {
  const a = String(alignment || "other")
    .toLowerCase()
    .replace(/_/g, "-");
  if (a === "western") return "western";
  if (a === "non-aligned" || a === "nonaligned" || a === "neutral") return "non-aligned";
  if (a === "adversarial") return "adversarial";
  return "other";
}

export function getDomain(url?: string): string {
  try {
    if (!url) return "";
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function formatTimeAgo(date?: string | Date): string {
  const then = date ? new Date(date).getTime() : Date.now();
  const now = Date.now();
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function pickTopHeadlines(
  pkg: SigintPackage,
  n = 3
): { asset: string; theater: string; alignment: string; headline: string; url: string }[] {
  const out: {
    asset: string;
    theater: string;
    alignment: string;
    headline: string;
    url: string;
  }[] = [];
  const seen = new Set<string>();
  const topHeadlines = pkg.topHeadlines || pkg.top_headlines || [];
  for (let i = 0; i < Math.min(pkg.sources.length, n * 2); i++) {
    const s = pkg.sources[i];
    if (!s) continue;
    const key = `${s.name}|${s.country}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const idx = pkg.sources.findIndex((x) => x.name === s.name && x.country === s.country);
    out.push({
      asset: s.name,
      theater: s.country,
      alignment: normAlignment(s.alignment),
      headline: topHeadlines[idx] || topHeadlines[i] || "",
      url: s.url,
    });
    if (out.length >= n) break;
  }
  return out;
}

export function sigintUrl(id: string): string {
  return `/botwavebomba/sigint.html?id=${encodeURIComponent(id)}`;
}

export function sectorUrl(id: string): string {
  return `/botwavebomba/${id}.html`;
}

export function portadaUrl(): string {
  return "/botwavebomba/";
}

// Backward-compatible aliases used by legacy modules and during migration
export type Story = SigintPackage;
export type Source = Asset;
export const getStories = getSigintPackages;
export const getSources = getAssets;
export const normBloc = normAlignment;
export const storyUrl = sigintUrl;
export const sectionUrl = sectorUrl;
export const homeUrl = portadaUrl;
export function getOwnershipByDomain(): Record<string, MoneyTrailLink> {
  return getMoneyTrailByDomain();
}
