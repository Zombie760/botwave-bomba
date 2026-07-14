# Contributing to BotwaveBomba

> **Not Left/Right. Who Owns The Story.**

Thank you for contributing. This document is the contract between you and the maintainers — follow it and your PR will be reviewed fast. Ignore it and it'll sit.

---

## 1. Before You Start

| Check | Required? |
|-------|-----------|
| Read this entire file | ✅ Yes |
| Sign commits with GPG (`git commit -S`) | ✅ Yes |
| Run `bun run lint && bun run format:check` locally | ✅ Yes |
| Check [existing issues](https://github.com/Zombie760/botwave-bomba/issues) | ✅ Yes |
| Open a draft PR for discussion before big changes | 🟡 Recommended |

---

## 2. Development Setup

```bash
# Prerequisites
# - Bun 1.1+ (https://bun.sh)
# - Git with GPG signing configured

git clone https://github.com/Zombie760/botwave-bomba.git
cd botwave-bomba
bun install

# Verify setup
bun run lint        # ESLint
bun run format:check  # Prettier
bun run build       # Full build → 20+ HTML files in repo root
```

**Dev server** (hot reload):
```bash
bun run dev         # http://localhost:3000
```

---

## 3. Project Structure (Mental Model)

```
botwave-bomba/
├── .github/
│   ├── workflows/ci.yml          # CI/CD — lint, build, deploy
│   ├── dependabot.yml            # Dependency updates
│   ├── CODEOWNERS                # Review routing
│   ├── PULL_REQUEST_TEMPLATE.md  # PR checklist
│   └── ISSUE_TEMPLATE/           # Bug, feature, asset addition
├── scripts/
│   ├── build_site.ts             # MAIN GENERATOR — 700+ lines
│   ├── dev_server.ts             # Hot-reload server
│   └── lib/                      # Pure logic (testable!)
│       ├── data.ts               # Types + loaders
│       ├── alignment.ts          # Sector classification, routing
│       ├── black-site.ts         # Black site detection
│       ├── radar.ts              # Signal density scan
│       ├── chronos.ts            # Temporal evolution
│       ├── numbers-station.ts    # Daily broadcast
│       └── sigint-card.ts        # UI card rendering
├── api/                          # Static JSON data (git-tracked)
│   ├── sigint-packages.json
│   ├── asset-registry.json
│   ├── money-trail.json
│   └── ...
├── assets/
│   ├── css/
│   │   ├── main.css              # Design system
│   │   ├── radar.css             # Canvas styles
│   │   └── print.css             # Print/PDF styles
│   ├── js/
│   │   ├── main.js               # Theme toggle, Dead Drop, nav
│   │   ├── radar.js              # Canvas renderer
│   │   └── chronos.js            # Table interactions
│   ├── img/
│   └── manifest.json             # PWA manifest
├── docs/                         # MkDocs documentation
│   ├── mkdocs.yml
│   └── docs/
│       ├── index.md
│       ├── getting-started/
│       ├── methodology/
│       ├── api/
│       ├── algorithms/
│       ├── contributing/
│       └── security/
├── *.html                        # 20+ generated pages (GitHub Pages root)
├── _headers                      # CSP + security headers
├── _redirects                    # Legacy URL redirects
├── package.json
├── tsconfig.json
├── ISA.md                        # Architecture contract
├── CONTRIBUTING.md
├── SECURITY.md
├── CODE_OF_CONDUCT.md
├── CHANGELOG.md
├── LICENSE
├── TERMINOLOGY_MAP.md            # Ground News → Botwave derivatives
└── README.md
```

**Golden rule:** Edit `scripts/lib/*.ts` and `scripts/build_site.ts`, then run `bun run build`. The `*.html` files in root are **generated artifacts** — committed for GitHub Pages, but source of truth is the build script.

---

## 4. Commit Convention

**Format:** `<type>(<scope>): <subject>`

| Type | When |
|------|------|
| `feat` | New page, new metric, new data field |
| `fix` | Bug in build, data, rendering, algorithm |
| `docs` | README, CHANGELOG, ISA, code comments |
| `refactor` | Code restructuring, no behavior change |
| `perf` | Build speed, bundle size, runtime perf |
| `chore` | Deps, CI, tooling, housekeeping |
| `data` | Asset registry updates, sigint re-cluster (patch) |
| `security` | Vulnerability fix, CSP hardening |

**Scope examples:** `build`, `black-site`, `radar`, `chronos`, `numbers-station`, `assets`, `ui`, `a11y`, `deps`, `ci`

**Examples:**
```
feat(black-site): add missing-adversarial filter to black site page
fix(build): handle missing sigint.excerpt in hero render
data(assets): add 12 new Global South outlets with ownership
docs(isa): document schema for BlackSiteIntel type
chore(deps): bump @mozilla/readability to 0.6.0
```

**Sign every commit:** `git commit -S -m "feat(black-site): ..."`

---

## 5. Pull Request Process

### 5.1 PR Title
Follow commit convention: `feat(black-site): add missing-adversarial filter`

### 5.2 PR Description Template
```markdown
## Summary
One paragraph: what, why, user-visible change.

## Type
- [ ] feat  - [ ] fix  - [ ] docs  - [ ] refactor
- [ ] perf  - [ ] chore - [ ] data  - [ ] security

## Testing
- [ ] `bun run lint` passes
- [ ] `bun run format:check` passes
- [ ] `bun run build` succeeds (check generated HTML)
- [ ] Manual verify: `bun run dev` → check affected pages
- [ ] [ ] Add unit test for new logic in `scripts/lib/`

## Screenshots
Required for UI changes (mobile + desktop).

## Checklist
- [ ] Commits signed (GPG)
- [ ] No generated `*.html` changes in diff (build runs in CI)
- [ ] CHANGELOG.md updated (Unreleased section)
- [ ] ISA.md updated if schema/algorithm changed
```

### 5.3 Review Requirements
| Check | Gate |
|-------|------|
| CI passes (lint, build, audit) | ✅ Required |
| Maintainer approval | ✅ Required (1) |
| No unsigned commits | ✅ Required |
| CHANGELOG updated | ✅ Required |

### 5.4 Merge
Squash merge only. Maintainer squashes with PR title as commit message.

---

## 6. Coding Standards

### TypeScript
- **Strict mode** — `tsconfig.json` has `"strict": true`
- **No `any`** — use `unknown` + type guards
- **Interfaces over types** for public APIs (`scripts/lib/*.ts`)
- **Explicit returns** on exported functions
- **JSDoc** on all exported functions + types

### CSS (`assets/css/main.css`)
- **Custom properties only** — no hardcoded colors/spacing
- **Mobile-first** — `@media (min-width: 900px)` for desktop
- **BEM-ish** — `.bwb-component__element--modifier`
- **No `!important`** — fix specificity instead

### HTML Generation (`scripts/build_site.ts`)
- **Escape everything** — `escapeHtml()` on all dynamic content
- **Semantic HTML** — `<article>`, `<section>`, `<nav>`, `<header>`, `<footer>`
- **ARIA** — labels, roles, `aria-expanded`, `aria-controls`
- **JSON-LD** — `WebPage`, `NewsArticle`, `BreadcrumbList`, `ItemList`
- **Deterministic** — no `Date.now()`, no random, same input = byte-identical output

### Accessibility Baseline (Non-Negotiable)
- Skip link (`<a class="bwb-skip-link" href="#main-content">`)
- Focus visible (`:focus-visible` outline)
- Contrast ≥ 4.5:1 (text), 3:1 (UI)
- Keyboard operable (all interactive elements)
- Alt text on all images (empty `alt=""` for decorative)

---

## 7. Adding Data (Assets, Intercepts, Ownership)

### 7.1 New Asset (`api/asset-registry.json`)
```json
{
  "name": "Outlet Name",
  "domain": "outlet.example.com",
  "country": "Country Name",
  "alignment": "western|non-aligned|adversarial|other",
  "owner": "Parent Company / Individual",
  "funding": "advertising|subscription|state|nonprofit|mixed",
  "credibility": 0.85,
  "lean": "left|center|right|varies|unknown",
  "notes": "Optional context"
}
```
**Required fields:** `name`, `domain`, `country`, `alignment`, `owner`, `funding`, `credibility`, `lean`

### 7.2 Ownership Mapping (`api/money-trail.json`)
```json
{
  "outlet.example.com": {
    "ultimate_owner": "Parent Corp",
    "ownership_chain": ["Outlet", "Intermediate Holding", "Parent Corp"],
    "public_filings": ["SEC EDGAR link", "Companies House link"]
  }
}
```

### 7.3 Sigint Packages (`api/sigint-packages.json`)
Generated by your ingestion pipeline — must match `SigintPackage` interface in `scripts/lib/data.ts`.

---

## 8. Algorithm Changes

Any change to:
- `scripts/lib/black-site.ts` (coverage ratio, silent sector logic)
- `scripts/lib/radar.ts` (intensity normalization, theater mapping)
- `scripts/lib/chronos.ts` (grouping, framing shift detection)
- `scripts/lib/alignment.ts` (sector routing, trending frequencies)

**Requires:**
1. Update `ISA.md` with new algorithm spec
2. Add unit test in `scripts/lib/__tests__/` (create if needed)
3. Document in `CHANGELOG.md` (Minor version if behavior changes)
4. Maintainer review + approval

---

## 9. Release Process (Maintainers Only)

```bash
# 1. Update version in package.json
npm version patch|minor|major  # or edit manually

# 2. Update CHANGELOG.md (move Unreleased → version)
# 3. Commit + tag
git commit -am "chore(release): v5.1.0"
git tag -s v5.1.0 -m "v5.1.0 - Black site filter + radar drill-down"

# 4. Push (triggers release workflow)
git push && git push --tags

# 5. GitHub Actions builds, creates Release, deploys to gh-pages
```

**Release artifacts:** GitHub Release with `dist/` zip + `botwavebomba-vX.Y.Z.html` (single-file snapshot).

---

## 10. Getting Help

| Channel | For |
|---------|-----|
| GitHub Issues | Bugs, feature requests, asset additions |
| GitHub Discussions | Design questions, algorithm debate |
| security@botwave.io | Vulnerabilities (see SECURITY.md) |
| conduct@botwave.io | Code of Conduct reports |

---

## 11. License

By contributing, you agree your contributions are licensed under the [MIT License](LICENSE).

---

## 12. Terminology

This project uses **Botwave sovereign terminology**, not Ground News clones. See [TERMINOLOGY_MAP.md](TERMINOLOGY_MAP.md) for the full mapping.

| Ground News Term | Botwave Term | Used In |
|------------------|--------------|---------|
| Blindspot | BLACK SITE | `black-site.html`, `scripts/lib/black-site.ts` |
| Heatmap | RADAR | `radar.html`, `scripts/lib/radar.ts` |
| Timeline | SPOOL | `spool.html`, `scripts/lib/chronos.ts` |
| For You | DEAD DROP | `dead-drop.html` |
| Newsletter | NUMBERS STATION | `numbers-station.html`, `scripts/lib/numbers-station.ts` |
| Source Registry | ASSET REGISTRY | `asset-registry.html` |
| Methodology | TRADECRAFT | `tradecraft.html` |
| Framing | REFRACTION | `refraction.html` |
| Corruption Tracker | MONEY TRAIL | `corruption.html` |
| Story | SIGINT PACKAGE | Core data model |
| Source | ASSET | Core data model |
| Bloc | ALIGNMENT | Core data model |

**Use Botwave terms in all code, docs, PRs, and issues.** Ground News terms only appear in `TERMINOLOGY_MAP.md` as reference.

---

*This document is part of the project's constitutional layer. Changes require a `docs` PR with maintainer review.*