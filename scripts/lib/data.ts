// BotwaveBomba data pipeline — reads canonical API JSON and exports typed helpers
export interface Asset {
  name: string;
  alignment: string;
  country: string;
  url: string;
  excerpt?: string;
  framing_placeholder?: string | null;
  // Tradecraft fields
  lean?: 'left' | 'center' | 'right';
  vetting?: 'high' | 'mixed' | 'low';
  tone?: 'neutral' | 'sensationalist' | 'opinion';
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
  primaryUrls: string[];
  sources: Asset[];
  // Tradecraft: refraction per asset
  refraction?: Record<string, string>;
  // Chronos support
  firstSeen?: string;
  lastUpdated?: string;
  peakCoverage?: string;
}

export interface MoneyTrailLink {
  domain: string;
  handler?: string;
  parentCompany?: string;
  handlerType?: string;
  motive?: string;
  evidenceUrl?: string;
}

export interface Meta {
  generatedAt: string;
  sigintCount: number;
  assetCountTotal: number;
  assetRegistryCount: number;
  theaterCount: number;
  alignmentSpread: Record<string, number>;
  diversityScore: number;
  silentSectorHeadline: string;
}

// Tradecraft: Black Site intel
export interface BlackSiteIntel extends SigintPackage {
  silentSector: string;
  coverageRatio: number;
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

import { readFileSync } from "node:fs";

const ROOT = `${import.meta.dir}/../..`;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function getSigintPackages(): SigintPackage[] {
  const data = readJson<{ stories?: SigintPackage[] }>(`${ROOT}/api/sigint-packages.json`);
  return data.stories || [];
}

export function getAssets(): Asset[] {
  const data = readJson<{ sources?: Asset[] }>(`${ROOT}/api/asset-registry.json`);
  return data.sources || [];
}

export function getMoneyTrail(): MoneyTrailLink[] {
  const data = readJson<{ entries?: MoneyTrailLink[] }>(`${ROOT}/api/money-trail.json`);
  return data.entries || [];
}

export function getMoneyTrailByDomain(): Record<string, MoneyTrailLink> {
  const list = getMoneyTrail();
  const map: Record<string, MoneyTrailLink> = {};
  for (const entry of list) {
    if (entry?.domain) map[entry.domain] = entry;
  }
  return map;
}

export function getMeta(): Meta {
  return readJson<Meta>(`${ROOT}/api/meta.json`);
}

export function getErrata() {
  return readJson<{ corrections?: any[] }>(`${ROOT}/api/errata.json`);
}

export function normAlignment(alignment?: string): string {
  const a = String(alignment || 'other').toLowerCase().replace(/_/g, '-');
  if (a === 'western') return 'western';
  if (a === 'non-aligned' || a === 'nonaligned' || a === 'neutral') return 'non-aligned';
  if (a === 'adversarial') return 'adversarial';
  return 'other';
}

export function getDomain(url?: string): string {
  try {
    if (!url) return '';
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function formatTimeAgo(date?: string | Date): string {
  const then = date ? new Date(date).getTime() : Date.now();
  const now = Date.now();
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function pickTopHeadlines(pkg: SigintPackage, n = 3): { asset: string; theater: string; alignment: string; headline: string; url: string }[] {
  const out: { asset: string; theater: string; alignment: string; headline: string; url: string }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < Math.min(pkg.sources.length, n * 2); i++) {
    const s = pkg.sources[i];
    if (!s) continue;
    const key = `${s.name}|${s.country}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const idx = pkg.sources.findIndex(x => x.name === s.name && x.country === s.country);
    out.push({
      asset: s.name,
      theater: s.country,
      alignment: normAlignment(s.alignment),
      headline: pkg.topHeadlines[idx] || pkg.topHeadlines[i] || '',
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
  return '/botwavebomba/';
}