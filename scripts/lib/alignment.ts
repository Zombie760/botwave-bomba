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
 * Get trending active frequencies (topics with most new signals)
 */
export function getActiveFrequencies(): { id: string; label: string; sigintIds: string[] }[] {
  return [
    { id: "ukraine-conflict", label: "UKRAINE CONFLICT", sigintIds: ["sig-001", "sig-002"] },
    { id: "taiwan-strait", label: "TAIWAN STRAIT", sigintIds: ["sig-003"] },
    { id: "gaza-israel", label: "GAZA / ISRAEL", sigintIds: ["sig-004", "sig-005"] },
    { id: "energy-politics", label: "ENERGY POLITICS", sigintIds: ["sig-006"] },
    { id: "tech-sovereignty", label: "TECH SOVEREIGNTY", sigintIds: ["sig-007"] },
  ];
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
