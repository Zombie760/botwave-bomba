# BotwaveBomba

> **Not Left/Right. Who Owns The Story.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-blue)](https://zombie760.github.io/botwavebomba/)
[![CI/CD](https://github.com/Zombie760/botwave-bomba/actions/workflows/ci.yml/badge.svg)](https://github.com/Zombie760/botwave-bomba/actions)
[![Bun](https://img.shields.io/badge/Built%20with-Bun-000?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Docs](https://img.shields.io/badge/Docs-MkDocs-blue)](https://zombie760.github.io/botwavebomba/docs/)

**BotwaveBomba** is a sovereign, open-source signal intelligence platform that surfaces media
alignment, ownership trails, and coverage gaps across outlets and countries — without trusting a
US-partisan axis. It implements a **three-axis geopolitical classification** (Western / Non-Aligned
/ Adversarial) as a static site deployed to GitHub Pages, with a Bun/TypeScript backend for data
ingestion.

**Live site:** https://zombie760.github.io/botwavebomba/

---

## Why This Exists

| Problem                                                    | BotwaveBomba's Answer                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Left/Center/Right bias labels are US-centric and reductive | **Three-axis alignment classification** across Western, Adversarial, and Non-Aligned blocs |
| "Many outlets report..." — which outlets?                  | **Named, filed assets** with handler, country, funding, vetting scores                     |
| Stories the West ignores / the Global South covers         | **Black Site detection** — the gap between alignments IS the story                         |
| No transparency on methodology                             | **Tradecraft pages** — every algorithm, threshold, and scoring rule documented             |
| Walled gardens, no API                                     | **Static JSON API** — all data in `api/*.json`, yours to mirror                            |

---

## Features

| Feature                      | Botwave Term    | Description                                                     | Page                    |
| ---------------------------- | --------------- | --------------------------------------------------------------- | ----------------------- |
| **Black Site Detection**     | BLACK SITE      | Intercepts covered heavily by one alignment, ignored by another | `/black-site.html`      |
| **Radar Scan**               | RADAR           | World choropleth of signal density by theater (country)         | `/radar.html`           |
| **Refraction Analysis**      | REFRACTION      | Side-by-side framing comparison per sigint package              | `/sigint.html?id=...`   |
| **Signal Evolution**         | SPOOL           | Intercept coverage growth over days/weeks                       | `/spool.html`           |
| **Personal Feed**            | DEAD DROP       | LocalStorage-based frequency monitoring (client-only)           | `/dead-drop.html`       |
| **Daily Broadcast**          | NUMBERS STATION | Automated daily critical briefing (HTML + JSON API)             | `/numbers-station.html` |
| **Asset Registry**           | ASSET REGISTRY  | 100+ named assets with handler, funding, vetting, lean          | `/asset-registry.html`  |
| **Methodology Transparency** | TRADECRAFT      | Every algorithm, threshold, and scoring rule documented         | `/tradecraft.html`      |
| **Money Trail**              | MONEY TRAIL     | FEC + 50-state SOS money trails, ownership chains               | `/corruption.html`      |

---

## Architecture

```
botwave-bomba/
├── .github/workflows/     # CI/CD (lint → build → deploy to gh-pages)
├── api/                   # Static JSON data served at runtime
│   ├── sigint-packages.json      # Clustered intercepts with assets + alignments
│   ├── asset-registry.json       # Asset registry (handler, credibility, funding)
│   ├── money-trail.json          # Media ownership mappings
│   └── ...
├── assets/                # CSS, JS, logos, manifest (PWA)
├── scripts/               # Build & dev tooling
│   ├── build_site.ts      # Main static site generator (Bun)
│   ├── dev_server.ts      # Hot-reload dev server
│   └── lib/               # Core logic (data.ts, alignment.ts, black-site.ts, radar.ts, spool.ts, numbers-station.ts, sigint-card.ts)
├── docs/                  # MkDocs documentation site
├── *.html                 # 20+ generated pages (index, sectors, features)
├── package.json           # Bun + TypeScript config
├── tsconfig.json
└── ISA.md                 # Ideal State Artifact (architecture contract)
```

**Stack:**

- **Runtime:** Bun (TypeScript native, fast cold starts)
- **Build:** `bun run scripts/build_site.ts` → 20+ HTML pages in repo root for GitHub Pages
- **Deploy:** GitHub Actions → `gh-pages` branch → GitHub Pages
- **Data:** Static JSON files (no DB, no server required at runtime)
- **Styling:** Custom CSS variables, dark/light themes, responsive
- **Docs:** MkDocs Material → `/docs/`

---

## Quickstart

```bash
# Prerequisites: Bun 1.1+
# Install: https://bun.sh

git clone https://github.com/Zombie760/botwave-bomba.git
cd botwave-bomba

# Install deps (just Bun lockfile)
bun install

# Dev server with hot reload (http://localhost:3000)
bun run dev

# Production build (outputs to repo root as *.html for GitHub Pages)
bun run build

# Lint + format check
bun run lint
bun run format:check

# Build documentation site
cd docs && pip install mkdocs-material && mkdocs serve
```

---

## Data Pipeline

The site is **data-driven**. The build reads `api/*.json` and generates all HTML. To refresh data:

```bash
# 1. Update asset registry
# Edit api/asset-registry.json (or run your ingestion pipeline)

# 2. Re-cluster sigint packages
# Run your ingestion → produces api/sigint-packages.json

# 3. Rebuild site
bun run build

# 4. Deploy (push to main triggers GitHub Actions)
git add -A && git commit -m "chore: refresh data $(date -I)" && git push
```

**Data schemas** (TypeScript interfaces in `scripts/lib/data.ts`):

- `SigintPackage` — clustered intercept with assets, alignment spread, refraction, bias
- `Asset` — outlet with handler, country, vetting, funding, alignment
- `BlackSiteIntel` — intercept + silent sector + coverage ratio
- `RadarContact` — theater + count + intensity
- `ChronosFrame` — date + sigint package + asset count + alignment spread

---

## Project Structure (Key Files)

| File                             | Purpose                                                                  |
| -------------------------------- | ------------------------------------------------------------------------ |
| `scripts/lib/data.ts`            | Core types, data loading, utilities (`normAlignment`, `getDomain`, etc.) |
| `scripts/lib/alignment.ts`       | Sector classification, trending frequencies, sector routing              |
| `scripts/lib/black-site.ts`      | Black site detection algorithm (coverage ratio per alignment)            |
| `scripts/lib/radar.ts`           | Theater-level signal density computation                                 |
| `scripts/lib/spool.ts`           | Signal evolution grouping by date                                        |
| `scripts/lib/numbers-station.ts` | Daily critical broadcast generation (HTML + JSON)                        |
| `scripts/lib/sigint-card.ts`     | Sigint package → UI card rendering (badges, alignments, assets)          |
| `scripts/build_site.ts`          | **Main generator** — 700+ lines, renders all 20+ pages                   |
| `ISA.md`                         | Architecture contract — what "done" looks like                           |

---

## Contributing

We welcome PRs that improve coverage, fix alignment detection, add assets, or harden the build.

1. **Read** [CONTRIBUTING.md](CONTRIBUTING.md) — coding standards, commit format, PR process
2. **Check** [ISSUE_TEMPLATE](.github/ISSUE_TEMPLATE/) — bug reports, feature requests, asset
   additions
3. **Run** `bun run lint && bun run format:check` before pushing
4. **Sign** commits (GPG) — `git commit -S`

**Good first issues:** `good first issue` label on GitHub.

---

## Security

- **No secrets in repo** — `.env` is gitignored; API keys only in GitHub Actions secrets
- **Static output only** — no server-side execution at runtime
- **CSP headers** — configured via `_headers` for GitHub Pages
- **Dependabot** — automated dependency updates
- **Report vulnerabilities** → [SECURITY.md](SECURITY.md)

---

## License

[MIT](LICENSE) — © 2026 Kyle Jimenez (Botwave)

> **Attribution:** If you fork this for your own signal platform, keep the "Not Left/Right. Who Owns
> The Story." tagline and link back to the Tradecraft page. The alignment detection algorithm is the
> IP.

---

## Related Repos

| Repo                                                                                    | Purpose                                                             |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [Zombie760.github.io](https://github.com/Zombie760/Zombie760.github.io)                 | Deployment target (gh-pages branch)                                 |
| [Botwave-Master-Consolidated](https://github.com/Zombie760/Botwave-Master-Consolidated) | Private monorepo (TELOS+PAI substrate, NISA, BotFox, Books, Bounty) |
| [botfox](https://github.com/Zombie760/botfox)                                           | Sovereign anti-detect browser (Camoufox + Purge + WaveSox)          |

---

## Contact

- **Telegram:** [@botwave_news](https://t.me/botwave_news)
- **GitHub Issues:**
  [Zombie760/botwave-bomba/issues](https://github.com/Zombie760/botwave-bomba/issues)
- **Email:** security@botwave.io (for vulnerabilities)
- **Tradecraft:** tradecraft@botwave.io (methodology disputes)

---

**Built on the Botwave TELOS+PAI substrate.** Every claim filed. Every source named.
