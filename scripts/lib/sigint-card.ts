// BotwaveBomba SIGINT CARD rendering
import { SigintPackage, formatTimeAgo, pickTopHeadlines, sigintUrl } from './data.ts';

export interface RenderedSigintCard {
  id: string;
  url: string;
  headline: string;
  excerpt: string;
  topAsset: { name: string; country: string; alignment: string } | null;
  topAlignment: string;
  assetCount: number;
  theaterCount: number;
  countryCount: number;
  timeAgo: string;
  alignmentCounts: Record<string, number>;
  badges: string[];
  heroAssets: { asset: string; theater: string; alignment: string; headline: string; url: string }[];
}

export function renderSigintCard(pkg: SigintPackage): RenderedSigintCard {
  const alignmentSpread = pkg.alignmentSpread || pkg.bloc_spread || {};
  const alignmentCounts = alignmentSpread;
  const topAlignment = getDominantAlignment(pkg);
  const assetCount = pkg.assetCount || pkg.sources.length || 1;
  const theaterCount = pkg.theaters?.length || 0;
  const countryCount = new Set(pkg.sources.map(s => s.country)).size;
  const timeAgo = formatTimeAgo(pkg.lastUpdated);
  const headlines = pickTopHeadlines(pkg, 1);
  const topHeadlines = pkg.topHeadlines || pkg.top_headlines || [];
  const headline = headlines[0]?.headline || topHeadlines[0] || 'Untitled signal';
  const topAsset = headlines[0] ? { name: headlines[0].asset, country: headlines[0].theater, alignment: headlines[0].alignment } : null;
  const excerpt = pkg.sources.map(s => s.excerpt).find(e => e && e.trim()) || topHeadlines[1] || '';

  // Badges based on alignment spread
  const badges: string[] = [];
  const total = assetCount;
  const spread = alignmentCounts;
  if ((spread.western || 0) / total < 0.2 && total >= 3) badges.push('WESTERN DARK');
  if ((spread['non-aligned'] || 0) / total < 0.2 && total >= 3) badges.push('NON-ALIGNED ABSENT');
  if ((spread.adversarial || 0) / total < 0.2 && total >= 3) badges.push('ADVERSARIAL SUPPRESSED');
  if (Object.values(spread).filter(c => c > 0).length >= 3) badges.push('GLOBAL');
  if ((spread['non-aligned'] || 0) > (spread.western || 0) && (spread['non-aligned'] || 0) > (spread.adversarial || 0)) badges.push('NON-ALIGNED LEAD');
  if ((spread.adversarial || 0) > (spread.western || 0) && (spread.adversarial || 0) > (spread['non-aligned'] || 0)) badges.push('ADVERSARIAL HEAVY');

  const heroAssets = pickTopHeadlines(pkg, 3).map(h => ({
    asset: h.asset,
    theater: h.theater,
    alignment: h.alignment,
    headline: h.headline,
    url: h.url
  }));

  return {
    id: pkg.id,
    url: sigintUrl(pkg.id),
    headline,
    excerpt,
    topAsset,
    topAlignment,
    assetCount,
    theaterCount,
    countryCount,
    timeAgo,
    alignmentCounts,
    badges,
    heroAssets
  };
}

function getDominantAlignment(pkg: SigintPackage): string {
  const spread = pkg.alignmentSpread || pkg.bloc_spread || {};
  let max = 0;
  let dominant = 'western';
  for (const [alignment, count] of Object.entries(spread)) {
    if (count > max) {
      max = count;
      dominant = alignment;
    }
  }
  return dominant;
}

export function sortSigintByBlackSite(packages: SigintPackage[]): SigintPackage[] {
  return [...packages].sort((a, b) => {
    const totalA = a.assetCount || a.sources.length || 1;
    const totalB = b.assetCount || b.sources.length || 1;
    const spreadA = a.alignmentSpread || a.bloc_spread || {};
    const spreadB = b.alignmentSpread || b.bloc_spread || {};
    
    const isBlackSiteA = Object.values(spreadA).some(c => c / totalA < 0.2) && totalA >= 3;
    const isBlackSiteB = Object.values(spreadB).some(c => c / totalB < 0.2) && totalB >= 3;
    
    if (isBlackSiteA && !isBlackSiteB) return -1;
    if (!isBlackSiteA && isBlackSiteB) return 1;
    
    // Both black sites or both not - sort by gap significance
    const gapA = isBlackSiteA ? Math.max(...Object.entries(spreadA).map(([_, c]) => (totalA - c) / totalA)) : 0;
    const gapB = isBlackSiteB ? Math.max(...Object.entries(spreadB).map(([_, c]) => (totalB - c) / totalB)) : 0;
    if (gapB !== gapA) return gapB - gapA;
    
    return totalB - totalA;
  });
}