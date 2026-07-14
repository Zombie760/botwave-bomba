# Botwave Terminology Map — Ground News → Botwave Derivatives

> **Rule:** No verbatim Ground News terms. Every concept gets a Botwave-flavored name: sovereign, gritty, slightly subversive. Spanish where it fits the "Al Gringo" byline, English neologisms where it hits harder.

---

## Core Concept Mapping

| Ground News Term | Botwave Derivative | Vibe |
|------------------|-------------------|------|
| **Blindspot** | **BLACK SITE** | Intelligence term for covert location. The coverage gap IS a black site — you know it exists, you can't see inside. |
| **Heatmap** | **RADAR** | Military/aviation. You're scanning the electromagnetic spectrum of global coverage. `/radar.html` |
| **Timeline** | **SPOOL** | Magnetic tape spooling. Stories unspool over time. `/spool.html` |
| **My Feed / For You** | **DEAD DROP** | Spycraft. Your followed topics = your dead drop location. Client-side only, no server knows. `/dead-drop.html` |
| **Newsletter / Digest** | **NUMBERS STATION** | Cold War shortwave broadcasts. Coded messages at scheduled intervals. `/numbers-station.html` |
| **Sources** | **ASSET REGISTRY** | Intelligence assets. Every outlet is a known asset with handler (owner), funding, reliability. `/asset-registry.html` |
| **Methodology** | **TRADECRAFT** | Spycraft fundamentals. How the sausage gets made, doctrinally. `/tradecraft.html` |
| **Daily Brief** | **SITREP** | Situation Report. Military standard. `/sitrep.html` |
| **Coverage Gap** | **SILENT SECTOR** | Radio silence. The frequency where no one's transmitting. |
| **Bloc / Bias Group** | **ALIGNMENT** | Geopolitical alignment, not domestic left/right. Western / Non-Aligned / Adversarial / Shadow |
| **Framing Analysis** | **REFRACTION** | Light through prism. Same story, different angle. |
| **Credibility Score** | **VETTING** | Background check. 0-100, weighted by ownership, funding, track record. |
| **Ownership Chain** | **MONEY TRAIL** | Follow the money. Outlet → parent → ultimate beneficiary. |
| **Story Cluster** | **SIGINT PACKAGE** | Signals Intelligence package. A herd of emissions on same frequency. |
| **Trending** | **ACTIVE FREQUENCIES** | What's transmitting right now. |
| **Balance** | **COUNTERMEASURE** | The antidote to single-bloc dominance. |

---

## Algorithm Module Renames

| Current File | New File | Export Name |
|--------------|----------|-------------|
| `blindspot.ts` | `black-site.ts` | `detectBlackSites()` |
| `heatmap.ts` | `radar.ts` | `scanRadar()` |
| `timeline.ts` | `spool.ts` | `unspool()` |
| `newsletter.ts` | `numbers-station.ts` | `broadcastNumbersStation()` |
| `classify.ts` | `alignment.ts` | `classifyAlignment()` |
| `story_card.ts` | `sigint-card.ts` | `renderSigintCard()` |

---

## Data Type Renames (scripts/lib/data.ts)

| Current Interface | New Interface |
|-------------------|---------------|
| `BlindspotStory` | `BlackSiteIntel` |
| `HeatmapCell` | `RadarContact` |
| `TimelineEntry` | `SpoolFrame` |
| `NewsletterIssue` | `NumbersStationBroadcast` |
| `Source` | `Asset` |
| `OwnershipEntry` | `MoneyTrailLink` |
| `StoryCluster` | `SigintPackage` |
| `Bloc` | `Alignment` |
| `FramingShift` | `RefractionEvent` |
| `CredibilityScore` | `VettingScore` |

---

## JSON API File Renames

| Current File | New File |
|--------------|----------|
| `api/stories_clustered.json` | `api/sigint-packages.json` |
| `api/sources_real_seed.json` | `api/asset-registry.json` |
| `api/ownership.json` | `api/money-trail.json` |
| `api/meta.json` | `api/meta.json` (unchanged) |

---

## UI Label Mapping

| Ground News UI | Botwave UI |
|----------------|------------|
| "Blindspot" | **BLACK SITE** |
| "Heatmap" | **RADAR** |
| "Timeline" | **SPOOL** |
| "For You" | **DEAD DROP** |
| "Newsletter" | **NUMBERS STATION** |
| "Sources" | **ASSET REGISTRY** |
| "Methodology" | **TRADECRAFT** |
| "Daily Brief" | **SITREP** |
| "Coverage Gap" | **SILENT SECTOR** |
| "Bias" | **ALIGNMENT** |
| "Credibility" | **VETTING** |
| "Ownership" | **MONEY TRAIL** |
| "Story Cluster" | **SIGINT PACKAGE** |
| "Trending" | **ACTIVE FREQUENCIES** |

---

## Navigation Structure (New)

```
index.html              →  PORTADA (Front page)
black-site.html         →  BLACK SITE (Blindspot detection)
radar.html              →  RADAR (Heatmap)
spool.html              →  SPOOL (Timeline)
dead-drop.html          →  DEAD DROP (Personal feed)
numbers-station.html    →  NUMBERS STATION (Newsletter)
asset-registry.html     →  ASSET REGISTRY (Sources)
tradecraft.html         →  TRADECRAFT (Methodology)
sitrep.html             →  SITREP (Daily brief)
errata.html             →  ERRATA (Corrections)
pro.html                →  PRO (Premium)
sin-senal.html          →  SIN SEÑAL (Offline)
perdido.html            →  PERDIDO (404)
```

---

## Voice Notes

- **All caps** for main nav items (BLACK SITE, RADAR, SPOOL) — feels like radio call signs
- **Hyphenated lowercase** for URLs (`black-site.html`, `numbers-station.html`)
- **Tagline bilingual toggle:** "Not Left/Right. Who Owns The Story." ↔ **"No Izquierda/Derecha. ¿Quién Posee La Historia?"**
- **Easter eggs:** Konami code on homepage reveals "DEFCON" mode (raw data view)

---

## Files to Update (Checklist)

- [ ] `scripts/build_site.ts` — page generation, nav, labels, JSON-LD
- [ ] `scripts/lib/data.ts` — interfaces, types, loaders
- [ ] `scripts/lib/black-site.ts` (rename from blindspot.ts)
- [ ] `scripts/lib/radar.ts` (rename from heatmap.ts)
- [ ] `scripts/lib/spool.ts` (rename from timeline.ts)
- [ ] `scripts/lib/numbers-station.ts` (rename from newsletter.ts)
- [ ] `scripts/lib/alignment.ts` (rename from classify.ts)
- [ ] `scripts/lib/sigint-card.ts` (rename from story_card.ts)
- [ ] `api/` — rename JSON files, update loaders
- [ ] `assets/js/botwave.js` — client-side labels, Dead Drop logic
- [ ] `assets/css/botwave.css` — component classes
- [ ] `docs/mkdocs.yml` — nav structure
- [ ] `docs/docs/` — all markdown content
- [ ] `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `ISA.md`
- [ ] `.github/workflows/ci.yml` — build verification (page count)