// BotwaveBomba timeline view — Ground News parity: story evolution over days
import { Story, normBloc } from './data.ts';

export interface TimelineEntry {
  date: string; // ISO date string
  storyId: string;
  headline: string;
  sourceCount: number;
  blocSpread: Record<string, number>;
  countries: string[];
  newSources: string[]; // Sources that appeared on this date
}

/**
 * Build timeline entries from stories (simulated daily snapshots based on source data)
 * In production, this would use actual historical snapshots
 */
export function buildTimeline(stories: Story[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const now = new Date();

  for (const story of stories) {
    // Simulate first_seen based on source count (more sources = older story)
    const daysAgo = Math.max(0, 7 - Math.floor((story.source_count || story.sources.length) / 3));
    const firstSeen = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    // Create daily entries for the story's lifecycle
    for (let d = 0; d <= daysAgo; d++) {
      const date = new Date(firstSeen.getTime() + d * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      // Simulate growing source count over time
      const sourceCountAtDate = Math.min(
        story.sources.length,
        Math.max(1, Math.floor((story.sources.length / (daysAgo + 1)) * (d + 1)))
      );
      
      const sourcesAtDate = story.sources.slice(0, sourceCountAtDate);
      const blocSpread: Record<string, number> = { western: 0, 'non-aligned': 0, adversarial: 0 };
      for (const s of sourcesAtDate) {
        const b = normBloc(s.bloc);
        if (blocSpread[b] !== undefined) blocSpread[b]++;
      }
      
      const countries = [...new Set(sourcesAtDate.map(s => s.country))];
      const newSources = d === 0 ? sourcesAtDate.map(s => s.name) : [];
      
      entries.push({
        date: dateStr,
        storyId: story.id,
        headline: story.top_headlines[0] || 'Untitled story',
        sourceCount: sourceCountAtDate,
        blocSpread,
        countries,
        newSources
      });
    }
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Group timeline entries by date for calendar-style display
 */
export function groupTimelineByDate(entries: TimelineEntry[]): Record<string, TimelineEntry[]> {
  const grouped: Record<string, TimelineEntry[]> = {};
  for (const entry of entries) {
    if (!grouped[entry.date]) grouped[entry.date] = [];
    grouped[entry.date].push(entry);
  }
  return grouped;
}

/**
 * Format date for display
 */
export function formatTimelineDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Get timeline for a specific story
 */
export function getStoryTimeline(entries: TimelineEntry[], storyId: string): TimelineEntry[] {
  return entries.filter(e => e.storyId === storyId).sort((a, b) => a.date.localeCompare(b.date));
}