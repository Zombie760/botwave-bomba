// BotwaveBomba sector classifier — assigns sigint packages to coverage desks
import { SigintPackage } from "./data.ts";

const SECTOR_KEYWORDS: Record<string, string[]> = {
  sports: [
    "world cup", "fifa", "football", "soccer", "wimbledon", "rugby", "cricket",
    "olympics", "nba", "nfl", "mlb", "tennis", "sports", "athlete", "match",
    "tournament", "championship", "semi-final", "semifinal", "quarterfinal",
    "quarter-final", "final", "goal", "score", "stadium", "team", "player",
  ],
  tech: [
    "apple", "openai", "ai ", "artificial intelligence", "tech", "technology",
    "semiconductor", "chip", "cyber", "hacking", "data breach", "startup",
    "software", "hardware", "electric vehicle", "ev ", "tesla", "spacex",
    "satellite", "quantum", "cryptocurrency", "crypto", "blockchain", "bitcoin",
  ],
  health: [
    "medical", "health", "hospital", "doctor", "disease", "outbreak", "epidemic",
    "pandemic", "vaccine", "virus", "malaria", "covid", "cancer", "mental health",
    "pharma", "drug", "treatment", "surgery", "patient", "who ", "cdc",
  ],
  science: [
    "science", "research", "study", "scientists", "reusable rocket", "rocket",
    "space", "nasa", "climate change", "global warming", "weather", "earthquake",
    "hurricane", "renewable energy", "solar", "nuclear", "fusion", "genetics",
    "biology", "physics", "astronomy", "ocean", "biodiversity", "conservation",
  ],
  business: [
    "trade", "tariff", "sanctions", "economy", "inflation", "recession",
    "markets", "stock", "investment", "corporation", "ceo", "earnings",
    "oil", "gas", "energy", "supply chain", "export", "import", "currency",
    "central bank", "fed ", "imf", "wto ", "debt", "loan", "fintech",
  ],
  conflict: [
    "war", "attack", "strike", "invasion", "occupation", "military", "soldier",
    "drone", "missile", "air strike", "airstrike", "bomb", "clash", "fighting",
    "conflict", "ceasefire", "hostage", "prisoner", "casualties", "killed",
    "destroyed", "evacuation", "siege",
  ],
  politics: [
    "election", "vote", "parliament", "congress", "senator", "minister",
    "president", "prime minister", "government", "opposition", "party",
    "policy", "law", "court", "supreme court", "legislation", "reform",
    "protest", "rally", "campaign", "diplomat", "summit", "g7", "g20", "nato",
  ],
};

export function classifySector(pkg: SigintPackage): string[] {
  const text = (pkg.topHeadlines || pkg.top_headlines || [])
    .concat(pkg.sources.map((s) => `${s.name} ${s.excerpt || ""}`))
    .join(" ")
    .toLowerCase();
  const sectors: string[] = [];
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some((k) => text.includes(k))) sectors.push(sector);
  }
  return sectors.length ? sectors : ["general"];
}

export function getPrimarySector(pkg: SigintPackage): string {
  return classifySector(pkg)[0];
}

export function getPackagesBySector(packages: SigintPackage[]): Record<string, SigintPackage[]> {
  const groups: Record<string, SigintPackage[]> = {};
  for (const pkg of packages) {
    for (const sector of classifySector(pkg)) {
      if (!groups[sector]) groups[sector] = [];
      groups[sector].push(pkg);
    }
  }
  return groups;
}
