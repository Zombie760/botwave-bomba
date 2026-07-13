# BotwaveBomba

**Not left/center/right. Five-axis bias fingerprints across Western, Adversarial, and Non-Aligned blocs. The gap IS the story.**

BotwaveBomba is a sovereign open-source news coverage platform built on the Botwave framework. It surfaces media bias, ownership trails, and coverage gaps across 100+ outlets and 16 countries, with GitHub Pages as the public face and a Bun-backed backend API for dynamic data serving.

- **Live site:** https://zombie760.github.io/botwavebomba/
- **License:** MIT
- **Stack:** Bun/TypeScript backend, static frontend, GitHub Actions CI
- **Data:** `api/*.json` with source registry, ownership mappings, and clustered stories

## Quick Start

```bash
# Clone
git clone https://github.com/zombie760/botwavebomba.git
cd botwavebomba

# Install deps
bun install

# Local build
bun run build

# Start backend API
cd server && PORT=3100 BWB_BASE_PATH=/botwavebomba bun index.ts

# Validate all assets
bun run validate
```

## Project Structure

- `server/` — Bun FastAPI-style backend serving `/api/bootstrap`, `/api/search`, `/api/meta`
- `scripts/` — TS build pipeline, ownership enrichment, clustering
- `assets/` — CSS, JS, logos, manifest
- `api/` — canonical JSON data files
- `.github/workflows/` — CI/CD for GitHub Pages

## Backend API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/meta` | Corpus stats, bloc spread, coverage gap headline |
| `GET /api/bootstrap` | Combined stories + sources + ownership payload |
| `GET /api/search?q=` | Full-text search with negation filters |
| `GET /health` | Health check |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE).
