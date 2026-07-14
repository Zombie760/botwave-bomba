// BotwaveBomba CHRONOS tape — Story evolution across time
import { Story, normBloc } from './data.ts';

export interface ChronosEntry {
  date: string; // ISO date string
  sigintId: string;
  headline: string;
  assetCount: number;
  alignmentSpread: Record<string, number>;
  theaters: string[];
  newAssets: string[]; // Sources that appeared on this date
}

/**
 * Build chronos entries from stories (simulated daily snapshots based on source data)
 * In production, this would use actual historical snapshots
 */
export function spoolChronos(stories: Story[]): ChronosEntry[] {
  const entries: ChronosEntry[] = [];
  const now = new Date();

  for (const story of stories) {
    // Simulate first_seen based on source count (more sources = older story)
    const daysAgo = Math.max(0, 7 - Math.floor((story.source_count || story.sources.length) / 3));
    const firstSeen = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    // Create daily entries for the story's lifecycle
    for (let d = 0; d <= daysAgo; d++) {
      const date = new Date(firstSeen.getTime() + d * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      // Simulate growing asset count over time
      const assetCountAtDate = Math.min(
        story.sources.length,
        Math.max(1, Math.floor((story.sources.length / (daysAgo + 1)) * (d + 1)))
      );
      
      const assetsAtDate = story.sources.slice(0, assetCountAtDate);
      const alignmentSpread: Record<string, number> = { western: 0, 'non-aligned': 0, adversarial: 0 };
      for (const s of assetsAtDate) {
        const a = normBloc(s.bloc);
        if (alignmentSpread[a] !== undefined) alignmentSpread[a]++;
      }
      
      const theaters = [...new Set(assetsAtDate.map(s => s.country))];
      const newAssets = d === 0 ? assetsAtDate.map(s => s.name) : [];
      
      entries.push({
        date: dateStr,
        sigintId: story.id,
        headline: story.top_headlines[0] || 'Untitled signal',
        assetCount: assetCountAtDate,
        alignmentSpread,
        theaters,
        newAssets
      });
    }
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Group chronos entries by date for calendar-style display
 */
export function groupChronosByDate(entries: ChronosEntry[]): Record<string, ChronosEntry[]> {
  const grouped: Record<string, ChronosEntry[]> = {};
  for (const entry of entries) {
    if (!grouped[entry.date]) grouped[entry.date] = [];
    grouped[entry.date].push(entry);
  }
  return grouped;
}

/**
 * Format date for display
 */
export function formatChronosDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Get chronos for a specific signal
 */
export function getSigintChronos(entries: ChronosEntry[], sigintId: string): ChronosEntry[] {
  return entries.filter(e => e.sigintId === sigintId).sort((a, b) => a.date.localeCompare(b.date));
}