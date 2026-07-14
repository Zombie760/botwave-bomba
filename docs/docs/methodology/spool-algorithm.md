# Spool Algorithm

> Signal evolution across time. Daily chronos frames showing coverage growth by alignment.

---

## Definition

```typescript
interface ChronosFrame {
  date: string;              // ISO date (YYYY-MM-DD)
  sigintId: string;          // Package ID
  headline: string;
  assetCount: number;        // Assets covering on this date
  alignmentSpread: Record<string, number>; // { western: n, 'non-aligned': n, adversarial: n }
  theaters: string[];        // Countries represented
  newAssets: string[];       // Assets newly appearing this date
}
```

---

## Simulation Logic (Current)

Since we don't have historical snapshots, we simulate from current data:

```typescript
function spoolChronos(packages: SigintPackage[]): ChronosFrame[] {
  const frames: ChronosFrame[] = [];
  const now = new Date();

  for (const pkg of packages) {
    // Simulate first_seen: more assets = older story
    const daysAgo = Math.max(0, 7 - Math.floor(pkg.sources.length / 3));
    const firstSeen = new Date(now.getTime() - daysAgo * 86400000);
    
    for (let d = 0; d <= daysAgo; d++) {
      const date = new Date(firstSeen.getTime() + d * 86400000);
      const dateStr = date.toISOString().split('T')[0];
      
      // Linear growth simulation
      const assetsAtDate = Math.min(
        pkg.sources.length,
        Math.max(1, Math.floor((pkg.sources.length / (daysAgo + 1)) * (d + 1)))
      );
      
      const assets = pkg.sources.slice(0, assetsAtDate);
      const spread: Record<string, number> = { western: 0, 'non-aligned': 0, adversarial: 0 };
      for (const a of assets) {
        const al = normAlignment(a.alignment);
        if (spread[al] !== undefined) spread[al]++;
      }
      
      const theaters = [...new Set(assets.map(a => a.country))];
      const newAssets = d === 0 ? assets.map(a => a.name) : [];
      
      frames.push({
        date: dateStr,
        sigintId: pkg.id,
        headline: pkg.topHeadlines[0] || 'Untitled signal',
        assetCount: assetsAtDate,
        alignmentSpread: spread,
        theaters,
        newAssets
      });
    }
  }

  return frames.sort((a, b) => b.date.localeCompare(a.date));
}
```

---

## Grouping by Date

```typescript
function groupChronosByDate(frames: ChronosFrame[]): Record<string, ChronosFrame[]> {
  const grouped: Record<string, ChronosFrame[]> = {};
  for (const f of frames) {
    if (!grouped[f.date]) grouped[f.date] = [];
    grouped[f.date].push(f);
  }
  return grouped;
}
```

---

## Table Rendering (HTML)

| Date | Assets | Alignment Mix | Intercept |
|------|--------|---------------|-----------|
| 2026-07-13 | 12 | ████░░░░░░░░░░ (W) ███░░░░░░░░░░ (NA) ██░░░░░░░░░░ (ADV) | "Ukraine counteroffensive stalls" (UA, PL, DE, RU) |

Alignment mix = stacked bar: Western / Non-Aligned / Adversarial proportions.

---

## Outputs

| Artifact | Path |
|----------|------|
| Page | `/spool.html` |
| JSON | `/api/spool.json` (all frames) |
| Grouped JSON | `/api/spool_by_date.json` |

---

## Future: Real Historical Snapshots

Replace simulation with actual daily builds:

1. **Cron job** runs `bun scripts/build_site.ts` daily at 06:00 UTC
2. **Artifact** `dist/api/sigint-packages.json` committed to `gh-pages` with date tag
3. **Spool build** reads last 14 days of tagged artifacts
4. **Real `firstSeen`** from earliest appearance in archive

---

## Caveats

- Current: simulated linear growth (not real)
- Alignment spread assumes assets don't change alignment mid-story
- No "asset dropped coverage" detection (only additive)
- Timezone: UTC (all dates)