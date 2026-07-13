// BotwaveBomba data pipeline — reads canonical API JSON and exports typed helpers
export interface Source {
  name: string;
  bloc: string;
  country: string;
  url: string;
  excerpt?: string;
  framing_placeholder?: string | null;
}

export interface Story {
  id: string;
  size: number;
  source_count: number;
  bloc_spread: Record<string, number>;
  bloc_source: string;
  countries: string[];
  top_headlines: string[];
  primary_urls: string[];
  sources: Source[];
}

export interface OwnershipEntry {
  domain: string;
  owner?: string;
  parent_company?: string;
  owner_type?: string;
  motive?: string;
  evidence_url?: string;
}

export interface Meta {
  generated_at: string;
  story_count: number;
  source_count_total: number;
  source_registry_count: number;
  country_count: number;
  bloc_spread: Record<string, number>;
  diversity_score: number;
  coverage_gap_headline: string;
}

import { readFileSync } from "node:fs";

const ROOT = `${import.meta.dir}/../..`;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function getStories(): Story[] {
  const data = readJson<{ stories?: Story[] }>(`${ROOT}/api/stories_clustered.json`);
  return data.stories || [];
}

export function getSources(): Source[] {
  const data = readJson<{ sources?: Source[] }>(`${ROOT}/api/sources_real_seed.json`);
  return data.sources || [];
}

export function getOwnership(): OwnershipEntry[] {
  return readJson<OwnershipEntry[]>(`${ROOT}/api/ownership.json`);
}

export function getOwnershipByDomain(): Record<string, OwnershipEntry> {
  const list = getOwnership();
  const map: Record<string, OwnershipEntry> = {};
  for (const entry of list) {
    if (entry?.domain) map[entry.domain] = entry;
  }
  return map;
}

export function getMeta(): Meta {
  return readJson<Meta>(`${ROOT}/api/meta.json`);
}

export function getCorrections() {
  return readJson<{ corrections?: any[] }>(`${ROOT}/api/corrections.json`);
}

export function normBloc(bloc?: string): string {
  const b = String(bloc || 'other').toLowerCase().replace(/_/g, '-');
  if (b === 'western') return 'western';
  if (b === 'non-aligned' || b === 'nonaligned' || b === 'neutral') return 'non-aligned';
  if (b === 'adversarial') return 'adversarial';
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

export function pickTopHeadlines(story: Story, n = 3): { source: string; country: string; bloc: string; headline: string; url: string }[] {
  const out: { source: string; country: string; bloc: string; headline: string; url: string }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < Math.min(story.sources.length, n * 2); i++) {
    const s = story.sources[i];
    if (!s) continue;
    const key = `${s.name}|${s.country}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const idx = story.sources.findIndex(x => x.name === s.name && x.country === s.country);
    out.push({
      source: s.name,
      country: s.country,
      bloc: normBloc(s.bloc),
      headline: story.top_headlines[idx] || story.top_headlines[i] || '',
      url: s.url,
    });
    if (out.length >= n) break;
  }
  return out;
}

export function storyUrl(id: string): string {
  return `/botwavebomba/story.html?id=${encodeURIComponent(id)}`;
}

export function sectionUrl(id: string): string {
  return `/botwavebomba/${id}.html`;
}

export function homeUrl(): string {
  return '/botwavebomba/';
}
