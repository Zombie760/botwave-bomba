// BotwaveBomba NUMBERS STATION — daily critical broadcast
import { SigintPackage, getSigintPackages, getMeta } from './data.ts';
import { detectBlackSites, getTopBlackSites, formatSilentSector } from './black-site.ts';
import { scanRadar, getCountryRadar, normalizeIntensity } from './radar.ts';
import { sortSigintByBlackSite } from './sigint-card.ts';

export interface NumbersStationBroadcast {
  id: string;
  date: string;
  title: string;
  html: string;
  sigintIds: string[];
  readTimeMin: number;
}

export function selectBroadcastSigint(packages: SigintPackage[], max = 5): { pkg: SigintPackage; isBlackSite: boolean; signalStrength: number }[] {
  const normalized = packages.map(p => ({
    pkg: p,
    isBlackSite: (() => {
      const total = p.assetCount || p.sources.length || 1;
      const spread = p.alignmentSpread || {};
      return Object.values(spread).some(c => c / total < 0.2) && total >= 3;
    })(),
    signalStrength: p.assetCount || p.sources.length || 1
  }));

  return normalized
    .sort((a, b) => {
      if (b.isBlackSite !== a.isBlackSite) return b.isBlackSite ? 1 : -1;
      return b.signalStrength - a.signalStrength;
    })
    .slice(0, max);
}

export function broadcastNumbersStation(packages?: SigintPackage[]): string {
  const sigintPackages = packages || getSigintPackages();
  const meta = getMeta();
  const selected = selectBroadcastSigint(sigintPackages);
  
  const hasBlackSites = selected.some(s => s.isBlackSite);
  const headlineAlert = hasBlackSites
    ? 'NISA Critical Flag: Significant black sites detected! Top priority analysis required.'
    : 'All major black sites accounted for!';

  const radarHtml = sigintPackages.map(p => {
    const score = Math.min((p.assetCount || p.sources.length || 1), 5);
    const hue = (score - 1) * 60;
    return '<span style="display:inline-block;width:14px;height:14px;margin:2px;border-radius:3px;background:hsl(' + hue + ',70%,50%);"></span>';
  }).join('');

  const sigintListHtml = selected.map(item => {
    const pkg = item.pkg;
    const total = pkg.assetCount || pkg.sources.length || 1;
    const spread = pkg.alignmentSpread || {};
    const isBlackSite = item.isBlackSite;
    const gapPct = isBlackSite ? Math.round(Math.max(...Object.entries(spread).map(([_, c]) => (total - c) / total)) * 100) : 0;
    const silentSector = isBlackSite ? Object.entries(spread).find(([_, c]) => c / total < 0.2)?.[0] || '' : '';
    
    return '<div style="margin-top:15px;padding:10px;border-left:3px solid ' + (isBlackSite ? '#E74C3C' : '#2ECC71') + ';background:#fefefe;">' +
      '<strong style="color:#2c3e50;">' + (pkg.topHeadlines?.[0] || pkg.top_headlines?.[0] || 'Untitled signal') + '</strong>' +
      '<span style="font-size:0.9em;color:#7f8c8d;">(' + pkg.id + ')</span>' +
      '<p style="margin:5px 0 10px 0;font-size:0.9em;">' + (pkg.sources.map(src => src.excerpt).find(e => e && e.trim()) || pkg.topHeadlines?.[1] || pkg.top_headlines?.[1] || '') + '</p>' +
      (isBlackSite ? '<span style="background:#E74C3C;color:white;padding:2px 6px;border-radius:3px;font-size:0.75em;">BLACK SITE: ' + formatSilentSector(silentSector) + ' (' + gapPct + '%)</span>' : '') +
      '<a href="/botwavebomba/sigint.html?id=' + encodeURIComponent(pkg.id) + '" style="color:#3498db;text-decoration:none;font-weight:bold;">[FULL INTEL] →</a>' +
    '</div>';
  }).join('');

  const blackSiteHtml = hasBlackSites ? 
    '<div style="margin-bottom:30px;padding:15px;background:#fdf2f2;border:1px solid #f5c6cb;border-radius:8px;">' +
      '<h2>Top 5 Black Sites & Silent Sectors</h2>' +
      '<p><strong>' + headlineAlert + '</strong></p>' +
      sigintListHtml +
    '</div>' : '';

  const readMin = Math.max(1, Math.round(sigintPackages.reduce((a, s) => a + (s.assetCount || s.sources.length), 0) * 0.15));

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>NISA Numbers Station | ' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '</title>\n  <style>\n    body { font-family:\'Helvetica Neue\',Arial,sans-serif;line-height:1.65;color:#333;max-width:700px;margin:auto;padding:20px 40px;background:#fdfdfd; }\n    h1 { color:#1abc9c;border-bottom:2px solid #eee;padding-bottom:10px; }\n    h2 { color:#2c3e50; }\n    a { color:#3498db; }\n    .footer { margin-top:50px;padding:20px;background:#eaf8f4;border-radius:8px;text-align:center; }\n  </style>\n</head>\n<body>\n  <h1>📡 NISA Numbers Station</h1>\n  <p style="color:#7f8c8d;">' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + ' · ' + sigintPackages.length + ' sigint packages · ' + readMin + 'm read</p>\n\n  ' + blackSiteHtml + '\n\n  <h2 style="text-align:center;margin-top:40px;">📊 RADAR SNAPSHOT (Global Volatility)</h2>\n  <div style="display:flex;justify-content:center;flex-wrap:wrap;padding:15px;border:1px solid #ddd;background:#f9f9f9;">\n    ' + radarHtml + '\n  </div>\n\n  <div class="footer">\n    <h3>Don\'t Miss a Beat. Subscribe to the Broadcast!</h3>\n    <p>Get critical geopolitical, technical, and cultural intercepts fired straight into your inbox.</p>\n    <form style="margin-top:20px;display:flex;justify-content:center;gap:10px;">\n      <input type="email" placeholder="Your Email Address (e.g., jane@corp.com)" required style="padding:10px;border:1px solid #ccc;border-radius:5px;width:60%;max-width:400px;">\n      <button type="submit" style="padding:10px 20px;background:#1abc9c;color:white;border:none;border-radius:5px;cursor:pointer;font-size:16px;">Subscribe</button>\n    </form>\n  </div>\n</body>\n</html>';
}

export function generateNumbersStationFile(): void {
  const html = broadcastNumbersStation();
  const ROOT = process.env.BOTWAVE_ROOT || `${import.meta.dir}/../..`;
  const { writeFileSync } = require("node:fs");
  writeFileSync(`${ROOT}/numbers-station.html`, html, "utf8");
  console.log('[numbers-station] broadcast generated');
}