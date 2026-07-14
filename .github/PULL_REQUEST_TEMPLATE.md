# Pull Request Template

## Summary
One paragraph: what changed, why, user-visible impact.

## Type
- [ ] feat
- [ ] fix
- [ ] docs
- [ ] refactor
- [ ] perf
- [ ] chore
- [ ] data
- [ ] security

## Scope
`build` | `blindspot` | `heatmap` | `timeline` | `newsletter` | `sources` | `ui` | `a11y` | `deps` | `ci` | `seo` | `schema`

## Testing
- [ ] `bun run lint` — passes
- [ ] `bun run format:check` — passes
- [ ] `bun run build` — succeeds, 20+ HTML files generated
- [ ] `bun run dev` — manual verify affected pages (mobile + desktop)
- [ ] Unit tests added/updated for new logic in `scripts/lib/`

## Screenshots
Required for UI changes. Attach mobile (375px) + desktop (1200px).

## Breaking Changes
- [ ] None
- [ ] Yes — describe: schema change, API change, HTML structure change

## CHANGELOG
Updated `CHANGELOG.md` under `## [Unreleased]`?

## ISA
Updated `ISA.md` if algorithm/schema changed?

## Checklist
- [ ] All commits signed (GPG)
- [ ] No generated `*.html` files in diff (CI builds them)
- [ ] Dependabot PRs: `bun run build` verified locally
- [ ] Self-review completed