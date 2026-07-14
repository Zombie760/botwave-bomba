// BotwaveBomba blindspot detection — Ground News parity: stories your side isn't covering
import { Story, normBloc } from './data.ts';

export interface BlindspotStory {
  story: Story;
  missingBloc: 'western' | 'non-aligned' | 'adversarial';
  coverageRatio: number; // 0-1, share of sources from missing bloc
  totalSources: number;
}

/**
 * Detect stories with significant coverage gaps by bloc
 * A "blindspot" = story where one bloc has < 20% representation
 */
export function computeBlindspots(stories: Story[]): BlindspotStory[] {
  const blindspots: BlindspotStory[] = [];
  const blocs: ('western' | 'non-aligned' | 'adversarial')[] = ['western', 'non-aligned', 'adversarial'];

  for (const story of stories) {
    const total = story.sources.length || 1;
    if (total < 3) continue; // Need minimum sources for meaningful gap

    const counts: Record<string, number> = { western: 0, 'non-aligned': 0, adversarial: 0 };
    for (const s of story.sources) {
      const b = normBloc(s.bloc);
      if (counts[b] !== undefined) counts[b]++;
    }

    for (const bloc of blocs) {
      const ratio = counts[bloc] / total;
      if (ratio < 0.2 && counts[bloc] === 0) {
        // Completely missing bloc coverage - strong blindspot
        blindspots.push({
          story,
          missingBloc: bloc,
          coverageRatio: ratio,
          totalSources: total
        });
      } else if (ratio < 0.2 && total > 5) {
        // Underrepresented bloc with enough total sources
        blindspots.push({
          story,
          missingBloc: bloc,
          coverageRatio: ratio,
          totalSources: total
        });
      }
    }
  }

  // Sort by most severe gaps first (lowest coverage ratio, then highest total sources)
  return blindspots.sort((a, b) => {
    if (a.coverageRatio !== b.coverageRatio) return a.coverageRatio - b.coverageRatio;
    return b.totalSources - a.totalSources;
  });
}

/**
 * Get top blindspots for display (max 5)
 */
export function getTopBlindspots(stories: Story[], max = 5): BlindspotStory[] {
  return computeBlindspots(stories).slice(0, max);
}

/**
 * Format missing bloc label for display
 */
export function formatMissingBloc(bloc: string): string {
  const labels: Record<string, string> = {
    'western': 'Missing Western coverage',
    'non-aligned': 'Missing Non-Aligned coverage',
    'adversarial': 'Missing Adversarial coverage'
  };
  return labels[bloc] || `Missing ${bloc} coverage`;
}