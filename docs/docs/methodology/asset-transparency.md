# Asset Transparency Registry

> Every asset is a known entity. Owner, funding model, vetting track record, paywall status, language. No hidden algorithms.

---

## Registry Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | Outlet display name | "Al Jazeera English" |
| `alignment` | enum | Geopolitical alignment | "non-aligned" |
| `country` | string | Headquarters / primary jurisdiction | "Qatar" |
| `url` | string | Homepage | "https://www.aljazeera.com" |
| `lean` | enum | Domestic partisan lean (within alignment) | "center" |
| `vetting` | enum | Credibility rating | "high" |
| `tone` | enum | Editorial tone | "neutral" |
| `funding` | string | Funding model description | "State-funded (Qatar Media Corporation)" |
| `independence` | string | Editorial independence details | "Charter guarantees independence; board appointed by Emir" |
| `paywall` | enum | Access model | "Free" |
| `language` | string | Primary language | "English" |
| `handler` | string | Owner / parent company (from money trail) | "Qatar Media Corporation" |

---

## Lean Values

| Value | Meaning |
|-------|---------|
| `left` | Progressive / redistributionist / anti-intervention (within alignment) |
| `center` | Balanced / institutionalist / status quo |
| `right` | Nationalist / market-oriented / interventionist (within alignment) |
| `unknown` | Insufficient data |

**Critical**: Lean is **alignment-relative**. "Left" in Adversarial ≠ "Left" in Western.

---

## Vetting Values

| Value | Criteria |
|-------|----------|
| `high` | <5% correction rate, >80% primary citations, IFCN signatory |
| `mixed` | 5-15% correction rate, 40-80% primary citations |
| `low` | >15% correction rate, <40% primary citations, heavy anonymous sourcing |
| `unknown` | Not yet assessed |

---

## Tone Values

| Value | Description |
|-------|-------------|
| `neutral` | Factual, restrained, minimal loaded language |
| `sensationalist` | Clickbait headlines, emotional amplification, speculation |
| `opinion` | Explicitly editorial/analysis format |

---

## Funding Values (Free Text, Categorized)

| Category | Examples |
|----------|----------|
| `state-funded` | BBC, RT, CGTN, Al Jazeera, DW, VOA |
| `public-broadcaster` | PBS, NPR, ABC (AU), CBC, France Médias Monde |
| `commercial` | NYT, WaPost, Guardian, Reuters, Bloomberg, FT |
| `non-profit` | ProPublica, The Intercept, Bellingcat, ICIJ |
| `oligarch-owned` | Daily Mail (Rothermere), Fox (Murdoch), various LatAm |
| `crowdfunded` | Declassified UK, The Grayzone, some Substack collectives |
| `unknown` | Not disclosed |

---

## Paywall Values

| Value | Meaning |
|-------|---------|
| `free` | No paywall |
| `metered` | N articles/month free |
| `hard` | Subscription required |
| `freemium` | Some free, premium content locked |
| `unknown` | Not determined |

---

## API

### Full Registry

`GET /api/asset-registry.json` → `Asset[]`

### By Domain

`GET /api/asset-registry_by_domain.json` → `Record<string, Asset>`

### Money Trail Links

`GET /api/money-trail.json` → `MoneyTrailLink[]`

```typescript
interface MoneyTrailLink {
  domain: string;
  handler?: string;
  parentCompany?: string;
  handlerType?: string;
  motive?: string;
  evidenceUrl?: string;
}
```

---

## HTML Page

`/asset-transparency.html` — Full table with badges:
- Alignment color bar
- Lean badge (L/C/R)
- Vetting badge (HIGH/MIXED/LOW)
- Funding category
- Paywall status
- Handler link → Money Trail

---

## Update Process

1. New asset → [Source Addition issue](https://github.com/Zombie760/botwave-bomba/issues/new?template=source_addition.md)
2. Researcher fills all fields + evidence URLs
3. Maintainer reviews, assigns alignment/lean/vetting
4. Merged → next build regenerates registry

---

## Disagreements Welcome

Asset classification wrong? Funding changed? New evidence?
[Open an issue](https://github.com/Zombie760/botwave-bomba/issues/new?template=source_addition.md) with sources. All corrections logged in `/api/errata.json`.