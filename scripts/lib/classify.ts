// Section classifier for BotwaveBomba stories
import { Story, Source, normBloc, getDomain } from './data.ts';

export interface SectionDef {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  domains: string[];
  countries: string[];
  blocs?: string[];
}


export const SECTIONS: SectionDef[] = [
  {
    id: 'for-you',
    label: 'For You',
    description: 'Stories from topics you follow. Followed topics are stored locally in your browser.',
    keywords: [],
    domains: [],
    countries: [],
  },
  {
    id: 'brief',
    label: 'Daily Briefing',
    description: 'The top coverage-gap stories of the day, distilled into a short read.',
    keywords: [],
    domains: [],
    countries: [],
  },
  {
    id: 'world',
    label: 'World',
    description: 'Global stories across Western, Non-Aligned, and Adversarial blocs.',
    keywords: ['global', 'world', 'international', 'summit', 'diplomat', 'treaty', 'nations', 'foreign', 'embassy', 'alliance', 'un ', 'united nations', 'nato', 'africa', 'asia', 'europe', 'americas', 'pacific'],
    domains: ['reuters.com', 'aljazeera.com', 'bbc.com', 'theguardian.com', 'france24.com', 'dw.com', 'channelnewsasia.com', 'scmp.com'],
    countries: [],
  },
  {
    id: 'politics',
    label: 'Politics',
    description: 'Legislation, elections, and institutional power across blocs.',
    keywords: ['election', 'vote', 'legislation', 'bill', 'parliament', 'congress', 'senate', 'minister', 'president', 'prime minister', 'policy', 'government', 'court ruling', 'supreme court', 'campaign', 'party', 'gop', 'democrat', 'republican', 'coalition'],
    domains: ['politico.com', 'thehill.com', 'axios.com', 'ft.com'],
    countries: [],
  },
  {
    id: 'conflict',
    label: 'Conflict',
    description: 'Warfare, security crises, sanctions, and military operations.',
    keywords: ['war', 'attack', 'strike', 'missile', 'drone', 'military', 'troop', 'invasion', 'ceasefire', 'hostilities', 'bombing', 'raid', 'sanctions', 'strait', 'hormuz', 'gaza', 'ukraine', 'iran', 'israel', 'hamas', 'hezbollah', 'nato', 'defense', 'army'],
    domains: ['defensenews.com', 'janes.com', 'aljazeera.com', 'rt.com'],
    countries: [],
  },
  {
    id: 'business',
    label: 'Business',
    description: 'Markets, trade, corporate moves, and economic policy.',
    keywords: ['market', 'stock', 'trade', 'tariff', 'economy', 'inflation', 'fed', 'central bank', 'interest rate', 'earnings', 'revenue', 'merger', 'acquisition', 'oil', 'energy', 'supply chain', 'gdp', 'recession', 'finance', 'investment'],
    domains: ['bloomberg.com', 'reuters.com', 'ft.com', 'wsj.com', 'cnbc.com', 'marketwatch.com'],
    countries: [],
  },
  {
    id: 'tech',
    label: 'Tech',
    description: 'Artificial intelligence, platforms, cybersecurity, and innovation.',
    keywords: ['ai', 'artificial intelligence', 'chatgpt', 'openai', 'google', 'meta', 'apple', 'microsoft', 'chip', 'semiconductor', 'cyber', 'hack', 'data', 'privacy', 'algorithm', 'platform', 'social media', 'smartphone', ' Tesla ', 'electric vehicle', 'spacex', 'satellite', 'quantum'],
    domains: ['techcrunch.com', 'theverge.com', 'arstechnica.com', 'wired.com', 'restofworld.org'],
    countries: [],
  },
  {
    id: 'sports',
    label: 'Sports',
    description: 'Global sports coverage and the bloc mix behind the scores.',
    keywords: ['world cup', 'olympic', 'match', 'game', 'tournament', 'championship', 'league', 'football', 'soccer', 'cricket', 'nba', 'mlb', 'nfl', 'fifa', 'uefa', 'tennis', 'athlete', 'sport'],
    domains: ['espn.com', 'bbc.com/sport', 'espncricinfo.com', 'goal.com'],
    countries: [],
  },
  {
    id: 'local',
    label: 'Local',
    description: 'Stories with strong regional or city-level angles outside the Western mainstream.',
    keywords: ['local', 'city', 'mayor', 'regional', 'province', 'state', 'municipal', 'town', 'county', 'residents', 'protest', 'strike', 'police', 'shooting', 'festival'],
    domains: [],
    countries: ['NG', 'GH', 'IN', 'PH', 'PK', 'ZA', 'KE', 'BD', 'LK', 'ID', 'MY'],
  },
  {
    id: 'blindspot',
    label: 'Blindspot',
    description: 'Stories where Western sources are scarce or missing from the cluster.',
    keywords: [],
    domains: [],
    countries: [],
    blocs: ['blindspot'],
  },
  {
    id: 'corruption',
    label: 'Corruption',
    description: 'Abuse of public office, financial crimes, and accountability reporting.',
    keywords: ['corruption', 'bribe', 'fraud', 'investigation', 'indictment', 'charges', 'court', 'trial', 'scandal', 'embezzle', 'money laundering', 'oligarch', 'sanctions', 'cartel', 'trafficking', 'narcotics'],
    domains: ['occrp.org', 'bellingcat.com'],
    countries: [],
  },
];

const TRENDING = [
  { id: 'iran', label: 'Iran' },
  { id: 'trump', label: 'Donald Trump' },
  { id: 'world-cup', label: 'World Cup' },
  { id: 'ai', label: 'Artificial Intelligence' },
  { id: 'heatwaves', label: 'Heatwaves' },
  { id: 'eu', label: 'European Union' },
  { id: 'crypto', label: 'Cryptocurrency' },
  { id: 'ukraine', label: 'Ukraine' },
];

export function getTrending() {
  return TRENDING;
}

function textForStory(story: Story): string {
  return [
    ...story.top_headlines,
    ...story.sources.map((s: Source) => `${s.name} ${s.country} ${getDomain(s.url)}`),
  ].join(' ').toLowerCase();
}

export function classifyStory(story: Story): string[] {
  const text = textForStory(story);
  const domains = story.sources.map((s: Source) => getDomain(s.url));
  const countries = story.countries || [];
  const total = story.source_count || story.sources.length || 1;
  const westernCount = story.bloc_spread?.western || 0;
  const nonWestern = total - westernCount;

  const tags: string[] = [];
  for (const section of SECTIONS) {
    if (section.id === 'blindspot') continue;
    const keywordMatch = section.keywords.some(k => text.includes(k.toLowerCase()));
    const domainMatch = section.domains.some(d => domains.some(dom => dom.includes(d)));
    const countryMatch = section.countries.length && section.countries.some(c => countries.includes(c));
    if (keywordMatch || domainMatch || countryMatch) tags.push(section.id);
  }

  // Blindspot rule: western sources are < 30% of total
  if (westernCount / total < 0.30) tags.push('blindspot');

  // Fallback
  if (!tags.length) tags.push('world');
  // for-you and brief are not auto-classified; they are curated/empty by default
  return tags;
}

export function getStoriesBySection(stories: Story[]): Record<string, Story[]> {
  const map: Record<string, Story[]> = {};
  for (const s of SECTIONS) map[s.id] = [];
  for (const story of stories) {
    for (const tag of classifyStory(story)) {
      map[tag]?.push(story);
    }
  }
  return map;
}
