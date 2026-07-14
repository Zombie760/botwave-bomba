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

export function getSigintPackages(): SigintPackage[] {
  // Try canonical name first, then legacy clustered file
  let data: { stories?: SigintPackage[] } | null = null;
  try {
    data = readJson<{ stories?: SigintPackage[] }>("api/sigint-packages.json");
  } catch {
    data = readJson<{ stories?: SigintPackage[] }>("api/stories_clustered.json");
  }
  return data?.stories || [];
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

export function getMoneyTrailByDomain(): Record<string, MoneyTrailLink> {
  const list = getMoneyTrail();
  const map: Record<string, MoneyTrailLink> = {};
  for (const entry of list) {
    if (entry?.domain) map[entry.domain] = entry;
  }
  return map;
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
