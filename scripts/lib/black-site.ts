// BotwaveBomba BLACK SITE detection — intelligence gaps across alignments
import { Story, normBloc } from './data.ts';

export interface BlackSiteIntel {
  story: Story;
  sigintPackage: Story;
  silentSector: 'western' | 'non-aligned' | 'adversarial';
  coverageRatio: number;
}

/**
 * Detect black sites: stories where one alignment has <20% representation
 * AND total sources >= 3
 */
export function detectBlackSites(stories: Story[]): BlackSiteIntel[] {
  const blackSites: BlackSiteIntel[] = [];
  const alignments = ['western', 'non-aligned', 'adversarial'] as const;

  for (const story of stories) {
    const spread = story.alignmentSpread || story.bloc_spread || {};
    const total = story.assetCount || story.source_count || story.sources.length || 1;
    if (total < 3) continue;

    for (const alignment of alignments) {
      const count = spread[alignment] || 0;
      const ratio = count / total;
      
      if (ratio < 0.2) {
        blackSites.push({
          story,
          sigintPackage: story,
          silentSector: alignment,
          coverageRatio: ratio
        });
        break; // Only flag once per story
      }
    }
  }

  return blackSites.sort((a, b) => {
    // Sort by gap significance: (1 - coverageRatio) * log(totalSources)
    const totalA = a.story.assetCount || a.story.source_count || a.story.sources.length;
    const totalB = b.story.assetCount || b.story.source_count || b.story.sources.length;
    const scoreA = (1 - a.coverageRatio) * Math.log(totalA);
    const scoreB = (1 - b.coverageRatio) * Math.log(totalB);
    return scoreB - scoreA;
  });
}

/**
 * Get top N black sites
 */
export function getTopBlackSites(stories: Story[], limit = 10): BlackSiteIntel[] {
  return detectBlackSites(stories).slice(0, limit);
}

/**
 * Format silent sector for display
 */
export function formatSilentSector(sector: string): string {
  switch (sector) {
    case 'western':
      return 'Missing Western';
    case 'non-aligned':
      return 'Missing Non-Aligned';
    case 'adversarial':
      return 'Missing Adversarial';
    default:
      return `Missing ${sector}`;
  }
}