// BotwaveBomba RADAR — world coverage scan by signal density
import { Story, normBloc } from "./data.ts";

export interface RadarContact {
  country: string;
  bloc: "western" | "non-aligned" | "adversarial" | "other";
  storyCount: number;
  sourceCount: number;
  topStoryIds: string[];
  topStoryId?: string;
}

export function scanRadar(stories: Story[]): RadarContact[] {
  const map = new Map<string, RadarContact>();

  for (const story of stories) {
    for (const source of story.sources) {
      const country = source.country || "Unknown";
      const bloc = normBloc(source.bloc) as RadarContact["bloc"];
      const key = `${country}|${bloc}`;

      const existing = map.get(key) || {
        country,
        bloc,
        storyCount: 0,
        sourceCount: 0,
        topStoryIds: [],
        topStoryId: story.id,
      };

      existing.storyCount += 1;
      existing.sourceCount += 1;
      if (existing.topStoryIds.length < 3) {
        existing.topStoryIds.push(story.id);
      }

      map.set(key, existing);
    }
  }

  return Array.from(map.values())
    .filter((c) => c.storyCount > 0)
    .sort((a, b) => b.storyCount - a.storyCount);
}

/**
 * Get aggregated radar by country only (for world map view)
 */
export function getCountryRadar(
  stories: Story[]
): Record<string, { count: number; blocs: Record<string, number>; topStories: string[] }> {
  const map: Record<
    string,
    { count: number; blocs: Record<string, number>; topStories: string[] }
  > = {};

  for (const story of stories) {
    for (const source of story.sources) {
      const country = source.country || "Unknown";
      const bloc = normBloc(source.bloc);

      if (!map[country]) {
        map[country] = {
          count: 0,
          blocs: { western: 0, "non-aligned": 0, adversarial: 0, other: 0 },
          topStories: [],
        };
      }
      map[country].count += 1;
      map[country].blocs[bloc] = (map[country].blocs[bloc] || 0) + 1;
      if (map[country].topStories.length < 3) {
        map[country].topStories.push(story.id);
      }
    }
  }

  return map;
}

/**
 * Normalize count to 0-1 intensity for color mapping
 */
export function normalizeIntensity(count: number, maxCount: number): number {
  if (maxCount <= 1) return 0.3;
  // Logarithmic scale for better visual distribution
  return Math.log1p(count) / Math.log1p(maxCount);
}
