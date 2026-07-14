# Black Site Detection Algorithm

> **Black Site** = An intercept where one geopolitical alignment has <20% representation among covering assets, AND total assets ≥ 3.

---

## Definition

```typescript
interface BlackSiteIntel {
  sigintPackage: SigintPackage;
  silentSector: 'western' | 'non-aligned' | 'adversarial';
  coverageRatio: number; // assets_in_sector / total_assets
}
```

## Detection Logic

```typescript
function detectBlackSites(packages: SigintPackage[]): BlackSiteIntel[] {
  const results: BlackSiteIntel[] = [];
  const sectors = ['western', 'non-aligned', 'adversarial'] as const;

  for (const pkg of packages) {
    const total = pkg.assetCount || pkg.sources.length || 1;
    if (total < 3) continue; // Minimum threshold

    const spread = pkg.alignmentSpread || {};
    
    for (const sector of sectors) {
      const count = spread[sector] || 0;
      const ratio = count / total;
      
      if (ratio < 0.20) { // 20% threshold
        results.push({
          sigintPackage: pkg,
          silentSector: sector,
          coverageRatio: ratio
        });
        break; // Only flag once per package
      }
    }
  }

  return results.sort((a, b) => {
    // Score: gap significance * log(asset count)
    const scoreA = (1 - a.coverageRatio) * Math.log(a.sigintPackage.sources.length);
    const scoreB = (1 - b.coverageRatio) * Math.log(b.sigintPackage.sources.length);
    return scoreB - scoreA;
  });
}
```

---

## Threshold Justification

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Minimum assets | 3 | Below 3, statistical noise dominates; 1-2 assets from one bloc is normal variance |
| Silence threshold | 20% | At 3 assets: 0/3 = 0%, 1/3 = 33%. 20% catches 0/3, 0/4, 0/5, 1/6+ |
| Scoring | `(1-ratio) * log(n)` | Penalizes total silence (ratio=0) more than near-silence; log dampens super-spreaders |

---

## Output: Top N Black Sites

```typescript
function getTopBlackSites(packages: SigintPackage[], limit = 10): BlackSiteIntel[] {
  return detectBlackSites(packages).slice(0, limit);
}
```

Used by:
- `/black-site.html` — Dedicated page
- `/numbers-station.html` — Daily broadcast top 5
- `SITREP` — Homepage top 5

---

## Silent Sector Labels

| Sector | Display Label | Meaning |
|--------|---------------|---------|
| `western` | **Western Dark** | Western-aligned assets absent |
| `non-aligned` | **Non-Aligned Absent** | Global South perspectives missing |
| `adversarial` | **Adversarial Suppressed** | Adversarial narratives blocked |

---

## False Positive Mitigation

1. **New story latency** — Fresh clusters (< 6h) may not have all alignments yet. *Mitigation: Only flag packages with `firstSeen` > 12h old (future enhancement).*
2. **Niche topics** — Some stories genuinely only concern one bloc (e.g., US Congress procedure). *Mitigation: Topic filter to exclude domestic-procedure tags.*
3. **Asset registry gaps** — Missing assets in registry = false silence. *Mitigation: Registry completeness metric per alignment; flag low-coverage topics.*

---

## API

- **Page**: `/black-site.html`
- **JSON**: `/api/black-sites.json` (top 20, regenerated each build)
- **Numbers Station**: Embedded in `/api/numbers-station_latest.json`

---

## Related

- [Alignment Taxonomy](alignment-taxonomy.md) — Three-axis classification
- [Radar Algorithm](radar-algorithm.md) — Global density scan
- [Numbers Station](numbers-station.md) — Daily broadcast format