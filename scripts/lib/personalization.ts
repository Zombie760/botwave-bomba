// BotwaveBomba personalization — Ground News parity: For You / Local / Topics
import { Story, normBloc } from './data.ts';

export interface Topic {
  id: string;
  label: string;
  storyIds: string[];
  followerCount?: number;
  country?: string;
}

export interface UserPreferences {
  followedTopics: string[];
  followedCountries: string[];
  followedBlocs: ('western' | 'non-aligned' | 'adversarial')[];
  locale: string;
  theme: 'light' | 'dark' | 'auto';
}

export const DEFAULT_TOPICS: Topic[] = [
  { id: 'geopolitics', label: 'Geopolitics', storyIds: [], followerCount: 0 },
  { id: 'conflict', label: 'Conflict & War', storyIds: [], followerCount: 0 },
  { id: 'corruption', label: 'Corruption', storyIds: [], followerCount: 0 },
  { id: 'tech', label: 'Technology', storyIds: [], followerCount: 0 },
  { id: 'business', label: 'Business & Markets', storyIds: [], followerCount: 0 },
  { id: 'climate', label: 'Climate & Energy', storyIds: [], followerCount: 0 },
  { id: 'health', label: 'Health', storyIds: [], followerCount: 0 },
  { id: 'human-rights', label: 'Human Rights', storyIds: [], followerCount: 0 },
  { id: 'elections', label: 'Elections', storyIds: [], followerCount: 0 },
  { id: 'sanctions', label: 'Sanctions & Trade', storyIds: [], followerCount: 0 }
];

const STORAGE_KEY = 'botwavebomba_prefs';

/**
 * Load user preferences from localStorage (client-side)
 * Server-side returns defaults
 */
export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') {
    return getDefaultPreferences();
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...getDefaultPreferences(), ...JSON.parse(stored) };
    }
  } catch {}
  return getDefaultPreferences();
}

export function getDefaultPreferences(): UserPreferences {
  return {
    followedTopics: [],
    followedCountries: [],
    followedBlocs: [],
    locale: 'en-US',
    theme: 'auto'
  };
}

/**
 * Save preferences to localStorage
 */
export function savePreferences(prefs: Partial<UserPreferences>): UserPreferences {
  const current = loadPreferences();
  const updated = { ...current, ...prefs };
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
  return updated;
}

/**
 * Extract topics from stories based on section classification and keywords
 */
export function extractTopicsFromStories(stories: Story[]): Topic[] {
  const topicMap = new Map<string, Set<string>>();
  
  // Section-based topics
  const sectionToTopic: Record<string, string> = {
    'world': 'geopolitics',
    'politics': 'elections',
    'conflict': 'conflict',
    'business': 'business',
    'tech': 'tech',
    'corruption': 'corruption'
  };

  for (const story of stories) {
    const sections = classifyStory(story);
    for (const section of sections) {
      const topicId = sectionToTopic[section];
      if (topicId) {
        if (!topicMap.has(topicId)) topicMap.set(topicId, new Set());
        topicMap.get(topicId)!.add(story.id);
      }
    }
    
    // Keyword-based extraction
    const text = story.top_headlines.join(' ').toLowerCase();
    const keywords: Record<string, string[]> = {
      'climate': ['climate', 'carbon', 'emission', 'renewable', 'warming', 'paris agreement', 'cop2'],
      'health': ['health', 'pandemic', 'vaccine', 'hospital', 'disease', 'who', 'covid'],
      'human-rights': ['human rights', 'amnesty', 'unhcr', 'refugee', 'detention', 'torture', 'freedom'],
      'sanctions': ['sanction', 'embargo', 'trade war', 'tariff', 'export control'],
      'elections': ['election', 'vote', 'ballot', 'campaign', 'parliament', 'congress']
    };
    
    for (const [topicId, kws] of Object.entries(keywords)) {
      if (kws.some(kw => text.includes(kw))) {
        if (!topicMap.has(topicId)) topicMap.set(topicId, new Set());
        topicMap.get(topicId)!.add(story.id);
      }
    }
  }

  // Build Topic objects
  return DEFAULT_TOPICS.map(t => ({
    ...t,
    storyIds: Array.from(topicMap.get(t.id) || []),
    followerCount: 0 // Would come from backend in production
  })).filter(t => t.storyIds.length > 0);
}

/**
 * Get topics with story counts for UI display
 */
export function getTopicsWithCounts(stories: Story[]): Topic[] {
  return extractTopicsFromStories(stories).map(t => ({
    ...t,
    followerCount: t.storyIds.length // Use story count as proxy for now
  }));
}

/**
 * Filter stories by user preferences
 */
export function filterStoriesForYou(stories: Story[], prefs: UserPreferences): Story[] {
  if (prefs.followedTopics.length === 0 && prefs.followedCountries.length === 0 && prefs.followedBlocs.length === 0) {
    return stories; // No preferences = show all
  }

  return stories.filter(story => {
    // Check topic match
    const storyTopics = classifyStory(story);
    const topicMatch = prefs.followedTopics.length === 0 || 
      prefs.followedTopics.some(t => storyTopics.includes(t));
    
    // Check country match
    const countryMatch = prefs.followedCountries.length === 0 ||
      story.countries.some(c => prefs.followedCountries.includes(c));
    
    // Check bloc match
    const storyBlocs = [...new Set(story.sources.map(s => normBloc(s.bloc)))];
    const blocMatch = prefs.followedBlocs.length === 0 ||
      prefs.followedBlocs.some(b => storyBlocs.includes(b));
    
    return topicMatch && countryMatch && blocMatch;
  });
}

/**
 * Get local stories based on user's followed countries or IP geolocation
 */
export function getLocalStories(stories: Story[], prefs: UserPreferences): Story[] {
  const countries = prefs.followedCountries;
  if (countries.length === 0) return [];
  
  return stories.filter(story => 
    story.countries.some(c => countries.includes(c))
  ).slice(0, 20);
}