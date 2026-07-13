// Pure data shaping for story cards — no HTML
import { Story, Source, normBloc, pickTopHeadlines, getDomain, formatTimeAgo } from './data.ts';

export interface StoryCardData {
  id: string;
  headline: string;
  excerpt: string;
  url: string;
  topSource: Source | null;
  topBloc: string;
  blocCounts: Record<string, number>;
  sourceCount: number;
  countryCount: number;
  countries: string[];
  timeAgo: string;
  badges: string[];
  heroSources: { source: string; country: string; bloc: string; headline: string; url: string }[];
}

export function storyToCard(story: Story): StoryCardData {
  const top = pickTopHeadlines(story, 3);
  const counts: Record<string, number> = { western: 0, 'non-aligned': 0, adversarial: 0, other: 0 };
  for (const s of story.sources) {
    counts[normBloc(s.bloc)] = (counts[normBloc(s.bloc)] || 0) + 1;
  }
  const topSource = story.sources[0] || null;
  const total = story.sources.length || 1;
  const badges: string[] = [];
  if ((story.bloc_spread?.western || 0) / total < 0.3) badges.push('Blindspot');
  if ((story.bloc_spread?.non_aligned || 0) / total > 0.6) badges.push('Non-Aligned Lead');
  if ((story.bloc_spread?.adversarial || 0) / total > 0.4) badges.push('Adversarial Heavy');
  if (story.countries.length > 8) badges.push('Global');

  // Excerpt: use the first non-empty source excerpt or fallback to a headline snippet
  let excerpt = story.sources.map(s => s.excerpt).find(e => e && e.trim()) || '';
  if (!excerpt && top[0]) excerpt = top[0].headline;
  if (excerpt.length > 220) excerpt = excerpt.slice(0, 217) + '…';

  return {
    id: story.id,
    headline: story.top_headlines[0] || 'Untitled story',
    excerpt,
    url: `/botwavebomba/story.html?id=${encodeURIComponent(story.id)}`,
    topSource,
    topBloc: normBloc(topSource?.bloc || 'other'),
    blocCounts: counts,
    sourceCount: story.source_count || story.sources.length,
    countryCount: story.countries.length,
    countries: story.countries,
    timeAgo: formatTimeAgo(),
    badges,
    heroSources: top,
  };
}

export function sortStoriesByCoverageGap(stories: Story[]): Story[] {
  return [...stories].sort((a, b) => {
    const aw = a.bloc_spread?.western || 0;
    const bw = b.bloc_spread?.western || 0;
    const at = a.source_count || a.sources.length || 1;
    const bt = b.source_count || b.sources.length || 1;
    // prefer lower western share, then higher source count
    return (aw / at - bw / bt) || (bt - at);
  });
}
