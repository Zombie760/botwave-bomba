# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] - main branch

### Added
- **Terminology overhaul** — Complete rename of all Ground News-derived terms to Botwave sovereign derivatives
  - Heatmap → **RADAR** (`radar.html`, `scripts/lib/radar.ts`, `RadarContact` type)
  - Blindspot Detection → **BLACK SITE** (`black-site.html`, `scripts/lib/black-site.ts`, `BlackSiteIntel` type)
  - Timeline → **SPOOL** (`spool.html`, `scripts/lib/chronos.ts`, `ChronosFrame` type)
  - For You → **DEAD DROP** (`dead-drop.html`)
  - Newsletter → **NUMBERS STATION** (`numbers-station.html`, `scripts/lib/numbers-station.ts`)
  - Source Registry → **ASSET REGISTRY** (`asset-registry.html`)
  - Methodology Transparency → **TRADECRAFT** (`tradecraft.html`, `docs/docs/methodology/`)
  - Framing Analysis → **REFRACTION** (`refraction.html`)
  - Corruption Tracker → **MONEY TRAIL** (`corruption.html`, `api/money-trail.json`)
  - Story → **SIGINT PACKAGE** (core data model: `SigintPackage`)
  - Source → **ASSET** (core data model: `Asset`)
  - Bloc → **ALIGNMENT** (core data model: `Alignment`)
- `TERMINOLOGY_MAP.md` — canonical mapping document
- Professional MkDocs documentation site with full methodology coverage
- MkDocs nav restructured: Methodology (Alignment Taxonomy, Black Site, Radar, Spool, Numbers Station, Asset Transparency, Tradecraft)

### Changed
- `scripts/build_site.ts` — all page generation, navigation, and internal references updated to Botwave terminology
- `scripts/lib/data.ts` — renamed interfaces: `Story`→`SigintPackage`, `Source`→`Asset`, `Bloc`→`Alignment`, `HeatmapCell`→`RadarContact`, `BlindspotStory`→`BlackSiteIntel`, `TimelineEntry`→`ChronosFrame`, `NewsletterPage`→`NumbersStationBroadcast`
- Algorithm files renamed: `blindspot.ts`→`black-site.ts`, `heatmap.ts`→`radar.ts`, `timeline.ts`→`chronos.ts`, `newsletter.ts`→`numbers-station.ts`, `classify.ts`→`alignment.ts`, `story_card.ts`→`sigint-card.ts`
- `README.md` — rewritten with Botwave terminology, professional badges, architecture diagram
- `CONTRIBUTING.md` — terminology section added, file paths updated
- `ISA.md` — terminology overhaul decision logged, all ISC criteria references updated
- MkDocs `mkdocs.yml` nav — methodology section fully restructured

### Removed
- All Ground News terminology from source code, generated pages, and documentation (except `TERMINOLOGY_MAP.md`)

---

## [5.0.0] - 2026-07-13

### Added
- **Blindspot Detection** — Ground News parity: coverage-gap clustering across Western/Non-Aligned/Adversarial blocs
- **Heatmap** — Country × bloc intensity grid with per-cell drill-down
- **Timeline** — Chronological story evolution with framing shift detection
- **For You** — Client-side followed-topic feed (localStorage, no server)
- **Newsletter** — Weekly digest generator (`generateNewsletterIssue`)
- **Sources Registry** — 120+ named outlets with ownership, bloc, credibility, bias scores
- **Methodology Transparency** — `/methodology-transparency.html` auto-generated from ISA
- **Schema.org JSON-LD** — `NewsMediaOrganization`, `ItemList`, `NewsArticle`, `BreadcrumbList`
- **Accessibility baseline** — Skip links, ARIA labels, focus-visible, contrast ≥ 4.5:1
- **Responsive design** — Mobile-first CSS grid, breakpoint at 900px/600px
- **Theme toggle** — Light/dark/system preference, persisted in localStorage
- **Search overlay** — Client-side fuse.js search across stories/sources/countries
- **Trending topics bar** — Auto-refresh from story frames
- Professional governance files: `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`
- GitHub Actions CI/CD workflow (`.github/workflows/ci.yml`)
- Dependabot configuration (`.github/dependabot.yml`)
- CODEOWNERS file
- Pull request template (`.github/PULL_REQUEST_TEMPLATE.md`)
- Issue templates (`.github/ISSUE_TEMPLATE/`)

### Changed
- **Architecture** — Single-file static build (`build_site.ts` → 20+ HTML pages)
- **Data layer** — `api/stories_clustered.json`, `api/sources_real_seed.json`, `api/meta.json`
- **Bloc taxonomy** — 4-bloc model (western, non-aligned, adversarial, other) with ownership mapping
- **Styling system** — CSS custom properties, Playfair Display + Inter + DM Mono
- `README.md` rewritten with professional badges, architecture diagram, quickstart
- `package.json` — added `lint:ci`, `test:ci`, `size:check` scripts for CI

### Fixed
- **Build reproducibility** — Deterministic output, no timestamps in generated HTML
- **CSP compliance** — Zero inline scripts, all assets self-hosted or integrity-pinned

### Security
- **Supply chain** — `bun.lock` committed, Dependabot enabled
- **Headers** — `_headers` with CSP, HSTS, X-Frame-Options, Referrer-Policy

---

## [4.2.0] - 2026-06-15

### Added
- Daily Briefing page (`brief.html`)
- Corrections page (`corrections.html`)
- Pro/Pricing page (`pro.html`)
- Sources registry page (`sources.html`)
- Offline page (`offline.html`) with Service Worker

### Changed
- Navigation restructure: Home / For You / Blindspot / World / Politics / Conflict / Business / Tech / Sports / Corruption
- Card component: bloc badges, source count, country count, time-ago

### Fixed
- Mobile nav toggle accessibility (ARIA expanded/controls)

---

## [4.1.0] - 2026-05-20

### Added
- Story clustering pipeline (Python → JSON)
- Ownership mapping for top 50 outlets
- Bias scoring methodology (AllSides + Media Bias/Fact Check cross-reference)

### Changed
- Domain extraction normalized (public suffix list)

---

## [4.0.0] - 2026-04-30

### Added
- Initial BotwaveBomba static site
- 5-section layout (World, Politics, Business, Tech, Sports)
- Basic story cards with source attribution
- GitHub Pages deployment

---

## Release Notes Convention

- **Patch** (`x.y.Z`) — bug fixes, data corrections, typo fixes, dependency updates
- **Minor** (`x.Y.z`) — new pages, new metrics, new data fields, non-breaking algorithm improvements
- **Major** (`X.y.z`) — schema changes, breaking algorithm changes, architecture rewrites

Data-only releases (source registry updates, story re-cluster) are **patch** unless schema changes.

---

## Links

- [GitHub Releases](https://github.com/Zombie760/botwave-bomba/releases)
- [Live Site](https://zombie760.github.io/botwavebomba/)
- [Tradecraft](/tradecraft.html)
- [Asset Registry](/asset-registry.html)