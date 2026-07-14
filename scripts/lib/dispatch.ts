// BotwaveBomba DISPATCH generator — Daily intel packet
import { Story, getStories } from './data.ts';

export interface DispatchStory {
  id: string;
  title: string;
  summary: string;
  isBlackSite: boolean;
  signalStrength: number;
  linkSlug: string;
}

export interface DispatchIssue {
  id: string;
  date: string;
  title: string;
  html: string;
  sigintIds: string[];
  readTimeMin: number;
}

export function selectDispatchStories(stories: Story[], max = 5): DispatchStory[] {
  const normalized = stories.map(s => ({
    id: s.id,
    title: s.top_headlines[0] || 'Untitled signal',
    summary: s.sources.map(src => src.excerpt).find(e => e && e.trim()) || s.top_headlines[1] || '',
    isBlackSite: (s.bloc_spread?.western || 0) / (s.source_count || s.sources.length || 1) < 0.3,
    signalStrength: s.source_count || s.sources.length || 1,
    linkSlug: `/botwavebomba/story.html?id=${encodeURIComponent(s.id)}`
  }));

  return normalized
    .sort((a, b) => {
      if (b.isBlackSite !== a.isBlackSite) return b.isBlackSite ? 1 : -1;
      const scoreA = a.signalStrength || 1;
      const scoreB = b.signalStrength || 1;
      return scoreB - scoreA;
    })
    .slice(0, max);
}

export function generateDispatchIssue(stories: Story[]): string {
  const selected = selectDispatchStories(stories);
  
  const hasBlackSites = selected.some(s => s.isBlackSite);
  const headlineAlert = hasBlackSites
    ? 'NISA Critical Flag: Significant black sites detected! Top priority analysis required.'
    : 'All major black sites accounted for!';

  const radarHtml = stories.map(s => {
    const score = Math.min((s.source_count || s.sources.length || 1), 5);
    const hue = (score - 1) * 60;
    return '<span style="display:inline-block;width:14px;height:14px;margin:2px;border-radius:3px;background:hsl(' + hue + ',70%,50%);"></span>';
  }).join('');

  const storyListHtml = selected.map(story => 
    '<div style="margin-top:15px;padding:10px;border-left:3px solid ' + (story.isBlackSite ? '#E74C3C' : '#2ECC71') + ';background:#fefefe;">' +
      '<strong style="color:#2c3e50;">' + escapeHtml(story.title) + '</strong>' +
      '<span style="font-size:0.9em;color:#7f8c8d;">(' + story.id + ')</span>' +
      '<p style="margin:5px 0 10px 0;font-size:0.9em;">' + escapeHtml(story.summary) + '</p>' +
      '<a href="' + story.linkSlug + '" style="color:#3498db;text-decoration:none;font-weight:bold;">[FULL INTEL] →</a>' +
    '</div>'
  ).join('');

  const blackSiteHtml = hasBlackSites ? 
    '<div style="margin-bottom:30px;padding:15px;background:#fdf2f2;border:1px solid #f5c6cb;border-radius:8px;">' +
      '<h2>Top 5 Black Sites & Silent Sectors</h2>' +
      '<p><strong>' + headlineAlert + '</strong></p>' +
      storyListHtml +
    '</div>' : '';

  const readMin = Math.max(1, Math.round(stories.reduce((a, s) => a + (s.source_count || s.sources.length), 0) * 0.15));

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>NISA Daily Dispatch | ' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '</title>\n  <style>\n    body { font-family:\'Helvetica Neue\',Arial,sans-serif;line-height:1.65;color:#333;max-width:700px;margin:auto;padding:20px 40px;background:#fdfdfd; }\n    h1 { color:#1abc9c;border-bottom:2px solid #eee;padding-bottom:10px; }\n    h2 { color:#2c3e50; }\n    a { color:#3498db; }\n    .footer { margin-top:50px;padding:20px;background:#eaf8f4;border-radius:8px;text-align:center; }\n  </style>\n</head>\n<body>\n  <h1>📧 NISA Daily Dispatch</h1>\n  <p style="color:#7f8c8d;">' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + ' · ' + stories.length + ' signals · ' + readMin + 'm read</p>\n\n  ' + blackSiteHtml + '\n\n  <h2 style="text-align:center;margin-top:40px;">📊 Radar Snapshot (Overall Volatility)</h2>\n  <div style="display:flex;justify-content:center;flex-wrap:wrap;padding:15px;border:1px solid #ddd;background:#f9f9f9;">\n    ' + radarHtml + '\n  </div>\n\n  <div class="footer">\n    <h3>Don\'t Miss a Beat. Subscribe to the Dispatch!</h3>\n    <p>Get critical geopolitical, technical, and cultural briefings fired straight into your inbox.</p>\n    <form style="margin-top:20px;display:flex;justify-content:center;gap:10px;">\n      <input type="email" placeholder="Your Email Address (e.g., jane@corp.com)" required style="padding:10px;border:1px solid #ccc;border-radius:5px;width:60%;max-width:400px;">\n      <button type="submit" style="padding:10px 20px;background:#1abc9c;color:white;border:none;border-radius:5px;cursor:pointer;font-size:16px;">Subscribe</button>\n    </form>\n  </div>\n</body>\n</html>';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/\"/g, '"')
    .replace(/'/g, ''');
}