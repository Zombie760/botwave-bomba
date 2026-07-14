# Radar Algorithm

> Global signal density scan by theater (country). Visualizes where media attention concentrates.

---

## Definition

```typescript
interface RadarContact {
  theater: string;
  alignment: 'western' | 'non-aligned' | 'adversarial' | 'other';
  signalCount: number;   // unique sigint packages
  assetCount: number;    // total asset appearances
  topSignalIds: string[];
}
```

## Aggregation

```typescript
function scanRadar(packages: SigintPackage[]): RadarContact[] {
  const map = new Map<string, RadarContact>();

  for (const pkg of packages) {
    for (const asset of pkg.sources) {
      const theater = asset.country || 'Unknown';
      const alignment = normAlignment(asset.alignment);
      const key = `${theater}|${alignment}`;

      const existing = map.get(key) || {
        theater,
        alignment,
        signalCount: 0,
        assetCount: 0,
        topSignalIds: []
      };

      existing.signalCount += 1;
      existing.assetCount += 1;
      if (existing.topSignalIds.length < 3) {
        existing.topSignalIds.push(pkg.id);
      }

      map.set(key, existing);
    }
  }

  return Array.from(map.values())
    .filter(c => c.signalCount > 0)
    .sort((a, b) => b.signalCount - a.signalCount);
}
```

---

## Country Rollup (Map View)

```typescript
function getCountryRadar(packages: SigintPackage[]): Record<string, {
  count: number;
  alignments: Record<string, number>;
  topSignals: string[];
}> {
  const map: Record<string, { count: number; alignments: Record<string, number>; topSignals: string[] }> = {};

  for (const pkg of packages) {
    for (const asset of pkg.sources) {
      const theater = asset.country || 'Unknown';
      const alignment = normAlignment(asset.alignment);

      if (!map[theater]) {
        map[theater] = { count: 0, alignments: { western: 0, 'non-aligned': 0, adversarial: 0, other: 0 }, topSignals: [] };
      }
      map[theater].count += 1;
      map[theater].alignments[alignment] = (map[theater].alignments[alignment] || 0) + 1;
      if (map[theater].topSignals.length < 3) {
        map[theater].topSignals.push(pkg.id);
      }
    }
  }

  return map;
}
```

---

## Intensity Normalization (Log Scale)

```typescript
function normalizeIntensity(count: number, maxCount: number): number {
  if (maxCount <= 1) return 0.3;
  return Math.log1p(count) / Math.log1p(maxCount);
}
```

**Why log1p?**
- Linear: US=847, Brazil=23 → Brazil invisible
- Log: US=1.0, Brazil=0.41 → both visible
- Prevents superpowers from drowning Global South

---

## Color Mapping (Canvas Render)

```
intensity ∈ [0.0, 0.33) : hsl(240, 70%, 50%)  // Blue (cold)
intensity ∈ [0.33, 0.66): hsl(120, 70%, 50%)  // Green
intensity ∈ [0.66, 1.0] : hsl(0, 70%, 50%)    // Red (hot)
```

Colorblind-safe (deuteranopia tested).

---

## Projection (Mercator)

```typescript
const project = (lat: number, lon: number) => ({
  x: (lon + 180) / 360 * width,
  y: (1 - Math.log(Math.tan(lat * Math.PI/180) + 1/Math.cos(lat * Math.PI/180)) / Math.PI) / 2 * height
});
```

Centroids hardcoded for 40+ major theaters.

---

## Outputs

| Artifact | Path | Description |
|----------|------|-------------|
| Page | `/radar.html` | Canvas + ranked table |
| JSON | `/api/radar.json` | `RadarContact[]` |
| Country JSON | `/api/radar_by_country.json` | Rollup by theater |

---

## Table Columns

| Column | Source |
|--------|--------|
| Theater | `theater` |
| Signal Count | `signalCount` |
| Alignment Mix | `alignment` counts |
| Top Signals | `topSignalIds` → links |

---

## Caveats

- Asset country ≠ signal theater (UK asset covering Ukraine → theater=Ukraine)
- Centroids approximate; some theaters multi-country
- Coverage ≠ importance (attention ≠ significance)
- Alignment at asset level, not per-signal