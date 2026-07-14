# BotwaveBomba Documentation

**Sovereign signal intelligence platform** — Global coverage gaps, named sources, three-axis alignment classification.

---

## Quick Links

| Resource | Description |
|----------|-------------|
| [Quickstart](getting-started/quickstart.md) | 3-minute local setup |
| [Architecture](getting-started/architecture.md) | System design & data flow |
| [Data Pipeline](getting-started/data-pipeline.md) | From RSS to SIGINT packages |
| [Alignment Taxonomy](methodology/alignment-taxonomy.md) | Three-axis geopolitical classification |
| [Black Site Detection](methodology/black-site-detection.md) | Silent sector identification algorithm |
| [Radar Algorithm](methodology/radar-algorithm.md) | Global signal density scan |
| [Spool](methodology/spool.md) | Signal evolution across time |
| [Numbers Station](methodology/numbers-station.md) | Daily critical broadcast |
| [Asset Transparency](methodology/asset-transparency.md) | Ownership, funding, vetting badges |
| [Tradecraft](methodology/tradecraft.md) | Full methodology transparency |
| [API Reference](api/sigint-packages.md) | Sigint packages, assets, metadata |
| [Algorithms](algorithms/black-site.md) | Core algorithm implementations |
| [Contributing](contributing/setup.md) | Development setup & standards |
| [Security](security/policy.md) | Vulnerability reporting, supply chain |

---

## Architecture Summary

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  RSS/Atom   │────▶│  Clustering  │────▶│  Alignment &    │
│  100+ Feeds │     │  (0.78 thresh)│     │  Lean/Vetting   │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
┌─────────────┐     ┌──────────────┐     ┌────────▼────────┐
│   GitHub    │◀────│  Static Gen  │◀────│  Sigint Packages│
│   Pages     │     │  (Bun/TS)    │     │  + Metadata     │
└─────────────┘     └──────────────┘     └─────────────────┘
```

**Build Pipeline**: `bun scripts/build_site.ts` → `dist/` → `gh-pages` branch → https://zombie760.github.io/botwavebomba/

---

## Methodology Pillars

| Pillar | Botwave Term | What It Does |
|--------|--------------|--------------|
| **Alignment** | Three-axis (Western / Non-Aligned / Adversarial) | Geopolitical media classification, not domestic left/right |
| **Black Site** | Silent Sector Detection | `<20%` alignment share + `≥3` assets = coverage gap flag |
| **Radar** | Global Signal Density | Log-scaled intensity by theater, mercator projection |
| **Spool** | Signal Evolution | Daily chronos frames showing coverage growth by alignment |
| **Numbers Station** | Daily Broadcast | Critical black sites + radar snapshot + alerts → HTML + JSON API |
| **Asset Transparency** | Registry + Badges | Owner, funding, vetting, lean, paywall per asset |
| **Tradecraft** | Full Disclosure | All algorithms, thresholds, sources public at `/tradecraft` |

---

## Key Metrics (Live Build)

| Metric | Target |
|--------|--------|
| Assets in registry | 100+ |
| Alignments covered | 3 (Western, Non-Aligned, Adversarial) |
| Build time | < 30s (Bun) |
| Deploy time | < 2 min (GitHub Actions) |
| Lighthouse score | ≥ 95 all categories |
| Accessibility | WCAG 2.1 AA |

---

## Not Left/Right. Who Owns The Story.

BotwaveBomba doesn't do "center bias." We map **geopolitical alignment** and **ownership structures** so you see *who's transmitting* and *what's missing*.

[Get Started →](getting-started/quickstart.md) | [View Live Site →](https://zombie760.github.io/botwavebomba/)