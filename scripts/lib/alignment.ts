// BotwaveBomba ALIGNMENT classification — three-axis geopolitical alignment
import { SigintPackage, normAlignment, getSigintPackages } from "./data.ts";

export interface AlignmentTag {
  id: string;
  label: string;
  description: string;
  color: string;
}

export const ALIGNMENTS: AlignmentTag[] = [
  {
    id: "western",
    label: "WESTERN",
    description: "NATO/EU/US-aligned media ecosystems",
    color: "#3B82F6",
  },
  {
    id: "non-aligned",
    label: "NON-ALIGNED",
    description: "Global South, BRICS, neutral/alternative perspectives",
    color: "#F59E0B",
  },
  {
    id: "adversarial",
    label: "ADVERSARIAL",
    description: "State media from regimes opposing Western bloc",
    color: "#EF4444",
  },
];

export const SECTORS = [
  {
    id: "black-site",
    label: "BLACK SITE",
    description: "Silent sectors — one alignment missing from coverage",
  },
  { id: "radar", label: "RADAR", description: "Global signal density scan by theater" },
  { id: "spool", label: "SPOOL", description: "Signal evolution across time — daily chronos" },
  {
    id: "dead-drop",
    label: "DEAD DROP",
    description: "Your monitored frequencies — opt-in personal feed",
  },
  {
    id: "numbers-station",
    label: "NUMBERS STATION",
    description: "Daily critical broadcast: black sites, radar, alerts",
  },
  {
    id: "asset-registry",
    label: "ASSET REGISTRY",
    description: "Named assets across all alignments — no hidden algorithms",
  },
  {
    id: "tradecraft",
    label: "TRADECRAFT",
    description: "How we classify alignment, vetting, ownership — full transparency",
  },
  {
    id: "sitrep",
    label: "SITREP",
    description: "Daily top intercepts by coverage gap significance",
  },
];

export const SECTIONS = SECTORS;

/**
 * Classify a sigint package by its alignment spread
 * Returns array of alignment tags present
 */
export function classifyAlignment(pkg: SigintPackage): string[] {
  const tags: string[] = [];
  const spread = pkg.alignmentSpread || {};
  if (spread.western) tags.push("western");
  if (spread["non-aligned"]) tags.push("non-aligned");
  if (spread.adversarial) tags.push("adversarial");
  return tags;
}

/**
 * Get the dominant alignment for a package
 */
export function getDominantAlignment(pkg: SigintPackage): string {
  const spread = pkg.alignmentSpread || {};
  let max = 0;
  let dominant = "western";
  for (const [alignment, count] of Object.entries(spread)) {
    if (count > max) {
      max = count;
      dominant = alignment;
    }
  }
  return dominant;
}

/**
 * Get trending active frequencies (topics with most new signals).
 * Now data-driven: scans the live SIGINT packages for keyword matches and
 * returns the most recent top-3 headlines per topic for hover previews.
 */
export function getActiveFrequencies(packages?: SigintPackage[]): {
  id: string;
  label: string;
  sigintIds: string[];
  count: number;
  topHeadlines: { id: string; headline: string; url: string; timeAgo: string }[];
}[] {
  const topics: { id: string; label: string; keywords: RegExp }[] = [
    { id: "iran-us", label: "IRAN / US", keywords: /\b(iran|tehran|khamenei|irgc|ceasefire|strait of hormuz|trump.*iran|iran.*trump|hezbollah)\b/i },
    { id: "middle-east", label: "MIDDLE EAST", keywords: /\b(israeli|israel|gaza|hamas|netanyahu|khan younis|rafah|qatar|emirates|khalifa|sheikh hamad|thani)\b/i },
    { id: "africa", label: "AFRICA", keywords: /\b(nigeria|oyo|shettima|tinubu|abuja|lagos|naija|kinshasa|johannesburg|kenya|ethiopia|lagos|african union)\b/i },
    { id: "china", label: "CHINA WATCH", keywords: /\b(china|chinese|beijing|xi jinping|pla|ccp|hong kong|taiwan(?!\sstrait))\b/i },
    { id: "spain-fires", label: "SPAIN FIRES", keywords: /\b(spain|spanish|madrid|wildfire|valencia|andalusia)\b/i },
  ];
  const pkgs = packages || getSigintPackages();
  const now = Date.now();
  return topics
    .map((t) => {
      const matches = pkgs
        .filter((p) => {
          const text = (p.topHeadlines || p.top_headlines || []).join(" ");
          return t.keywords.test(text);
        })
        .sort((a, b) => {
          // newest first
          const ta = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
          const tb = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
          return tb - ta;
        });
      const topHeadlines = matches.slice(0, 3).map((p) => {
        const headline = (p.topHeadlines || p.top_headlines || [])[0] || "Untitled";
        const ageMin = p.lastUpdated ? Math.max(0, Math.round((now - new Date(p.lastUpdated).getTime()) / 60000)) : 0;
        const timeAgo =
          ageMin < 1
            ? "just now"
            : ageMin < 60
              ? `${ageMin}m ago`
              : ageMin < 1440
                ? `${Math.round(ageMin / 60)}h ago`
                : `${Math.round(ageMin / 1440)}d ago`;
        return { id: p.id, headline, url: `/botwavebomba/sigint.html?id=${p.id}`, timeAgo };
      });
      return {
        id: t.id,
        label: t.label,
        sigintIds: matches.map((p) => p.id),
        count: matches.length,
        topHeadlines,
      };
    })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Get sigint packages grouped by sector
 */
export function getStoriesByAlignment(packages: SigintPackage[]): Record<string, SigintPackage[]> {
  const grouped: Record<string, SigintPackage[]> = {};
  for (const sector of SECTORS) {
    grouped[sector.id] = [];
  }

  for (const pkg of packages) {
    const total = pkg.assetCount || pkg.sources.length || 1;
    const spread = pkg.alignmentSpread || {};
    const isBlackSite = Object.values(spread).some((c) => c / total < 0.2) && total >= 3;
    if (isBlackSite) {
      grouped["black-site"].push(pkg);
    }

    const dominant = getDominantAlignment(pkg);
    if (dominant === "western") grouped["radar"].push(pkg);
    else if (dominant === "non-aligned") grouped["spool"].push(pkg);
    else if (dominant === "adversarial") grouped["numbers-station"].push(pkg);
    else grouped["dead-drop"].push(pkg);
  }

  return grouped;
}

/**
 * Get trending sigint packages (most assets, recent)
 */
export function getTrending(packages?: SigintPackage[]): SigintPackage[] {
  const pool = packages || getSigintPackages();
  return pool
    .sort((a, b) => (b.assetCount || b.sources.length) - (a.assetCount || a.sources.length))
    .slice(0, 10);
}

/**
 * Get packages by sector
 */
export function getStoriesBySector(sectorId: string, packages: SigintPackage[]): SigintPackage[] {
  const grouped = getStoriesByAlignment(packages);
  return grouped[sectorId] || [];
}
