# Tradecraft — Full Methodology Disclosure

> No black boxes. Every classification, threshold, and data source documented here.

---

## 1. Data Sources

### RSS/Atom Feeds
- 100+ outlets across 35+ countries
- Polled every 4 hours via distributed fetchers
- Feed list: `/api/feed_sources.json`
- Failure alerts: GitHub Actions workflow `feed-health.yml`

### Article Extraction
- Full text via readability.js + custom heuristics
- Fallback: `meta[property="og:description"]`, `meta[name="description"]`
- Language detection: `franc` (ISO 639-3)

### Clustering
- Embedding: `sentence-transformers/all-MiniLM-L6-v2` (384-dim)
- Similarity threshold: **0.78** (cosine)
- Algorithm: HDBSCAN (min_cluster_size=3, min_samples=2)
- Output: `api/stories_clustered.json` → transformed to `api/sigint-packages.json`

---

## 2. Alignment Classification

### Three-Axis Model
See [Alignment Taxonomy](alignment-taxonomy.md)

### Per-Asset (Not Per-Story)
Alignment assigned at **asset level**, not per intercept.  
Rationale: An outlet's geopolitical stance is structural, not situational.

### Re-evaluation
- Quarterly: 50 new test stories per asset
- Trigger: Ownership change, editor purge, state crackdown
- Log: `/api/errata.json`

---

## 3. Lean Rating (Within Alignment)

### Method
- 500-article sample per asset (stratified by topic)
- Keyword frequency analysis (500+ tagged terms)
- Human review of 50 borderline cases per asset

### Keyword Categories (Partial)
| Category | Left Terms | Right Terms |
|----------|------------|-------------|
| Economic | "inequality", "wealth tax", "regulation" | "deregulation", "tax cuts", "free market" |
| Social | "equity", "inclusion", "reproductive rights" | "traditional values", "law and order", "border security" |
| Foreign Policy | "diplomacy", "multilateralism", "restraint" | "deterrence", "sovereignty", "strength" |

### Output
`lean` field in asset registry: `left` | `center` | `right` | `unknown`

---

## 4. Vetting Rating (Credibility)

### Metrics (Per Asset, 200-Article Sample)

| Metric | Source | High Threshold | Low Threshold |
|--------|--------|----------------|---------------|
| Correction rate | Public corrections page | < 5% | > 15% |
| Primary citation rate | Links to docs/data/official statements | > 80% | < 40% |
| Anonymous source rate | "sources said", "officials familiar" | < 15% | > 30% |
| IFCN signatory | Duke Reporters' Lab database | Yes | No |

### Composite
```
score = 0.4*(1 - correction_rate) + 0.3*primary_citation_rate + 0.2*(1 - anon_rate) + 0.1*ifcn
```
- `≥ 0.75` → HIGH
- `0.50–0.75` → MIXED
- `< 0.50` → LOW

---

## 5. Black Site Detection

See [Black Site Detection](black-site-detection.md)

### Formula
```
gap_score = (1 - alignment_share) * log(total_assets)
```

### Thresholds
- `total_assets ≥ 3`
- `alignment_share < 0.20`

---

## 6. Radar Intensity

See [Radar Algorithm](radar-algorithm.md)

### Formula
```
intensity = log1p(signal_count) / log1p(max_country_count)
```

### Projection
Mercator, hardcoded centroids for 40 theaters.

---

## 7. Spool (Temporal Evolution)

See [Spool Algorithm](spool-algorithm.md)

### Current: Simulated
Linear growth from `first_seen` (estimated by asset count) to now.

### Future: Real
Daily tagged builds → 14-day rolling archive.

---

## 8. Numbers Station

See [Numbers Station](numbers-station.md)

### Alerts
- `NEW_BLACK_SITE`: Black site appears that wasn't in previous broadcast
- `COVERAGE_SHIFT`: >15pp change in any alignment share for top-20 theater

---

## 9. Asset Transparency

See [Asset Transparency](asset-transparency.md)

### Money Trail
Ownership chain from domain → registrant → parent company → ultimate beneficial owner (where public).
Sources: WHOIS, OpenCorporates, SEC filings, investigative reporting (ICIJ, OCCRP).

---

## 10. Framing Analysis

### Per-Asset Excerpt Comparison
For each intercept, we extract the lede paragraph from each covering asset.

### Comparison Dimensions
| Dimension | Method |
|-----------|--------|
| **Actor emphasis** | NER: which entities named in first 3 sentences |
| **Causal attribution** | Verb analysis: "X attacked Y" vs "Clashes erupted" |
| **Moral language** | Lexicon: "terrorist/freedom fighter", "invasion/special operation" |
| **Source weighting** | % quotes from: government, military, NGOs, civilians, anonymous |

### Output
`framing` field in sigint package: `Record<assetName, framingString>`

---

## 11. Corrections & Errata

### Process
1. Error detected (internal audit, user report, source correction)
2. Entry added to `/api/errata.json`
3. Next build: corrected data + errata banner on affected pages
4. Git history preserves original

### Errata Entry
```json
{
  "date": "2026-07-10",
  "sigintId": "sig-001",
  "field": "alignmentSpread.adversarial",
  "before": 2,
  "after": 3,
  "reason": "Missing RT Spanish feed added; re-clustered",
  "source": "Internal audit #47"
}
```

---

## 12. Reproducibility

### Build
```bash
git clone https://github.com/Zombie760/botwave-bomba
cd botwave-bomba
bun install
bun scripts/build_site.ts
# Output in dist/
```

### Data
- All source JSON in `/api/` (committed to `gh-pages`)
- Feed list in `/api/feed_sources.json`
- Clustering threshold in `scripts/lib/data.ts` (constant)

### Verification
- `bun test` — unit tests for algorithms
- `bun run check` — TypeScript + lint + format
- GitHub Actions: `ci.yml` runs on every push

---

## 13. What We DON'T Do

| Practice | Our Policy |
|----------|------------|
| Personalization by default | Opt-in only (Dead Drop = localStorage) |
| User tracking | None. No GA on Numbers Station. |
| Algorithmic feed ranking | Chronological + gap-sorted only |
| Hidden classification | All thresholds public |
| Paywalled methodology | Fully open |
| Single-narrative framing | Multi-alignment excerpts always shown |

---

## 14. Changelog

Methodology changes tracked in [CHANGELOG.md](../../CHANGELOG.md) with `methodology:` prefix.

---

## 15. Contact

Disagree? Evidence-based corrections welcome.
- GitHub: [Issues](https://github.com/Zombie760/botwave-bomba/issues)
- Email: `tradecraft@botwave.io`
- Telegram: `@botwave_tradecraft`