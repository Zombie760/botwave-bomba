# Security Policy

## Supported Versions

| Version | Supported        |
| ------- | ---------------- |
| 5.0.x   | ✅ Yes (current) |
| 4.x.x   | ❌ No            |
| < 4.0   | ❌ No            |

Only the latest major version receives security updates. Data corrections (source registry, story
clusters) are released as patches on the current major.

---

## Reporting a Vulnerability

**Do not file public issues for security vulnerabilities.**

Email: **security@botwave.io**

Include:

- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Suggested fix (if any)

We acknowledge within **48 hours** and aim to ship a fix within **7 days** for confirmed issues.

---

## Scope

### In Scope

- Static site generator (`scripts/build_site.ts`, `scripts/lib/*.ts`)
- Client-side JavaScript (`assets/js/botwave.js`)
- GitHub Actions workflows (`.github/workflows/*.yml`)
- Dependency supply chain (`package.json`, `bun.lock`)
- Content Security Policy (`_headers`)
- Data ingestion pipeline (if you contribute one)

### Out of Scope

- GitHub Pages infrastructure (report to GitHub Security)
- Browser zero-days (report to vendor)
- Third-party CDN (fonts.googleapis.com, fonts.gstatic.com — we pin via CSP)
- User-submitted data (sources, stories — we validate but don't guarantee)

---

## Security Architecture

| Layer            | Mechanism                                                                                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Build**        | Deterministic Bun build, no network access during `bun run build`                                                                                                                                                                        |
| **Dependencies** | `bun.lock` committed, Dependabot weekly, `bun audit` in CI                                                                                                                                                                               |
| **Runtime**      | Static HTML only — no server, no DB, no auth, no user input at runtime                                                                                                                                                                   |
| **Headers**      | CSP, HSTS, X-Frame-Options, Referrer-Policy via `_headers`                                                                                                                                                                               |
| **CSP**          | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'` |
| **Supply chain** | Signed commits required (GPG), SLSA Level 2 provenance on releases                                                                                                                                                                       |

---

## Data Integrity

| Asset                        | Integrity Check                                                       |
| ---------------------------- | --------------------------------------------------------------------- |
| `api/stories_clustered.json` | SHA-256 in `api/meta.json`                                            |
| `api/sources_real_seed.json` | Schema validation in `scripts/lib/data.ts`                            |
| `api/ownership.json`         | Cross-referenced with public filings                                  |
| Generated HTML               | `bun run build` is deterministic — same input = byte-identical output |

---

## Dependency Policy

- **Direct deps only:** `@mozilla/readability`, `jsdom` — both widely audited
- **Dev deps only in CI:** `@types/bun`, `@types/jsdom`, `eslint`, `prettier`
- **No transitive bloat:** Bun's native resolver avoids `node_modules` sprawl
- **Audit gate:** `bun audit` must pass in CI (fails on moderate+)

---

## Disclosure Timeline

| Phase             | Target                                                    |
| ----------------- | --------------------------------------------------------- |
| Acknowledge       | ≤ 48 hours                                                |
| Triage            | ≤ 5 days                                                  |
| Fix developed     | ≤ 7 days (critical), ≤ 14 days (high), ≤ 30 days (medium) |
| Release           | Next patch version                                        |
| Public disclosure | After fix released + 7 days                               |

We credit reporters in release notes (unless anonymity requested).

---

## Contact

**Security team:** security@botwave.io **Maintainer:** Kyle Jimenez (@Zombie760) **PGP:** Available
on request — email security@botwave.io

---

_This policy is part of the project's constitutional layer. Changes require a `docs` PR with
maintainer review._
