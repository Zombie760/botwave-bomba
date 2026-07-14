# Getting Started — Quickstart

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Bun** | ≥ 1.1 | `curl -fsSL https://bun.sh/install \| bash` |
| **Python** | ≥ 3.10 | System package manager |
| **MkDocs + Material** | Latest | `pip install mkdocs-material` |
| **Git** | Any | System package manager |

---

## 3-Minute Local Setup

```bash
# 1. Clone
git clone https://github.com/Zombie760/botwave-bomba.git
cd botwave-bomba

# 2. Install Bun deps
bun install

# 3. Start dev server (hot reload)
bun run dev
# → http://localhost:3000

# 4. (Optional) Start docs server
cd docs && mkdocs serve
# → http://localhost:8000
```

---

## Verify Build

```bash
# Production build
bun run build
# Output: *.html files in repo root (for GitHub Pages)

# Lint & format
bun run lint
bun run format:check

# Type check
bunx tsc --noEmit
```

---

## Deploy Preview

```bash
# Build
bun run build

# Test locally (serves built files)
bunx serve .
# → http://localhost:3000
```

---

## Common Issues

| Symptom | Fix |
|---------|-----|
| `bun: command not found` | Restart shell after install, or `export PATH="$HOME/.bun/bin:$PATH"` |
| `Module not found` | `bun install` (lockfile out of sync) |
| Build fails on `scripts/lib/*.ts` | Check `tsconfig.json` paths; run `bunx tsc --noEmit` |
| Dev server port in use | `bun run dev --port 3001` |
| MkDocs `python.name` errors | Ensure `mkdocstrings[python]` installed: `pip install mkdocstrings[python]` |

---

## Directory Layout (Post-Build)

```
botwave-bomba/
├── index.html              # PORTADA (home)
├── black-site.html         # BLACK SITE
├── radar.html              # RADAR
├── spool.html              # SPOOL
├── numbers-station.html    # NUMBERS STATION
├── sigint.html             # Intercept detail (query param: ?id=)
├── refraction.html         # REFRACTION (framing compare)
├── dead-drop.html          # DEAD DROP (personal feed)
├── asset-registry.html     # ASSET REGISTRY
├── tradecraft.html         # TRADECRAFT (methodology)
├── corruption.html         # MONEY TRAIL
├── api/                    # Static JSON API
│   ├── sigint-packages.json
│   ├── asset-registry.json
│   ├── money-trail.json
│   └── ...
├── assets/                 # CSS, JS, manifest
└── dist/                   # (gitignored) build artifact copy
```

---

## Next Steps

- [Architecture](architecture.md) — Data flow, build pipeline, design system
- [Data Pipeline](../getting-started/data-pipeline.md) — Ingest → cluster → build
- [Contributing Setup](../contributing/setup.md) — PR workflow, signing, CI