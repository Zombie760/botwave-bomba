# Numbers Station Broadcast

> **Numbers Station**: Cold War shortwave stations broadcasting coded messages to agents in the field.  
> **NISA Numbers Station**: Daily static broadcast of critical black sites, radar snapshot, and alerts. No tracking. No cookies. No JavaScript required.

---

## Broadcast Spec

| Property | Value |
|----------|-------|
| **Frequency** | Daily, 06:00 UTC (rebuilt at site deploy) |
| **Format** | HTML5 + JSON API |
| **Tracking** | None (no GA, no pixels, no cookies) |
| **Caching** | `Cache-Control: max-age=86400, must-revalidate` |
| **Indexing** | `<meta name="robots" content="noindex, nofollow">` |

---

## HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>NISA Numbers Station — 2026-07-13</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    /* Minimal, printable, no external deps */
    body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 720px; margin: 0 auto; padding: 2rem; }
    header { border-bottom: 2px solid #1a1a2e; padding-bottom: 1rem; margin-bottom: 2rem; }
    .classification { color: #e74c3c; font-weight: bold; font-size: 0.875rem; }
    h1 { color: #1a1a2e; margin: 0; }
    time { color: #666; }
    section { margin-bottom: 2rem; }
    .black-site { border-left: 4px solid #e74c3c; padding-left: 1rem; margin: 1rem 0; background: #fdf2f2; }
    .radar-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .radar-dot { width: 12px; height: 12px; border-radius: 3px; }
    footer { border-top: 1px solid #eee; padding-top: 1rem; margin-top: 3rem; font-size: 0.875rem; color: #666; }
    a { color: #3498db; }
  </style>
</head>
<body>
  <header>
    <h1>NISA NUMBERS STATION</h1>
    <time datetime="2026-07-13">13 JULY 2026 • 0600 ZULU</time>
    <p class="classification">FOR OFFICIAL USE ONLY — NO TRACKING • NO COOKIES • NO JS REQUIRED</p>
  </header>

  <section id="black-sites">
    <h2>⚡ CRITICAL BLACK SITES</h2>
    <!-- Top 5 black sites -->
    <div class="black-site">
      <strong>sig-ukr-grain-001</strong> — Ukraine grain corridor talks stall
      <br><span style="color:#e74c3c;">ADVERSARIAL SUPPRESSED (0% / 12 assets)</span>
    </div>
  </section>

  <section id="radar">
    <h2>📡 RADAR SNAPSHOT — Top 10 Theaters</h2>
    <div class="radar-row">
      <span class="radar-dot" style="background:hsl(0,70%,50%);"></span>
      <span class="radar-dot" style="background:hsl(60,70%,50%);"></span>
      <!-- ... -->
    </div>
    <table>
      <thead><tr><th>Theater</th><th>Signals</th><th>Alignment</th></tr></thead>
      <tbody>
        <tr><td>Ukraine</td><td>47</td><td>W:28 NA:12 ADV:7</td></tr>
      </tbody>
    </table>
  </section>

  <section id="alerts">
    <h2>🚨 ALERTS</h2>
    <ul>
      <li>NEW BLACK SITE: sig-taiwan-strait-003 — Non-Aligned Absent (94% gap)</li>
      <li>COVERAGE SHIFT: sig-energy-politics-007 — Western share dropped 34% → 18%</li>
    </ul>
  </section>

  <footer>
    <p>Broadcast generated at build time. Next: 2026-07-14 0600Z.</p>
    <p><a href="/api/numbers-station_latest.json">JSON API</a> | <a href="/">PORTADA</a></p>
  </footer>
</body>
</html>
```

---

## JSON API

**Endpoint**: `/api/numbers-station_latest.json`

```json
{
  "id": "numbers-station-2026-07-13",
  "date": "2026-07-13",
  "title": "NISA Numbers Station — 13 July 2026",
  "html": "<!DOCTYPE html>...",
  "blackSites": [
    {
      "sigintId": "sig-ukr-grain-001",
      "silentSector": "adversarial",
      "gapScore": 3.18,
      "headline": "Ukraine grain corridor talks stall"
    }
  ],
  "radarTop10": [
    { "theater": "Ukraine", "signalCount": 47, "alignments": { "western": 28, "non-aligned": 12, "adversarial": 7 } }
  ],
  "alerts": [
    { "type": "NEW_BLACK_SITE", "sigintId": "sig-taiwan-strait-003", "silentSector": "non-aligned" },
    { "type": "COVERAGE_SHIFT", "sigintId": "sig-energy-politics-007", "previousWesternShare": 0.34, "currentWesternShare": 0.18 }
  ]
}
```

---

## Generation Code

```typescript
// scripts/lib/numbers-station.ts
export function broadcastNumbersStation(): string {
  const packages = getSigintPackages();
  const selected = selectBroadcastSigint(packages, 5);
  // ... render HTML (see implementation)
}

export function generateNumbersStationFile(): void {
  const html = broadcastNumbersStation();
  writeFileSync(`${ROOT}/numbers-station.html`, html);
  writeJson('api/numbers-station_latest.json', {
    id: `numbers-station-${today}`,
    date: today,
    title: `NISA Numbers Station ${formatDate(today)}`,
    html,
    blackSites: selected.filter(s => s.isBlackSite).map(...),
    radarTop10: getCountryRadar(packages).sort(...).slice(0, 10),
    alerts: computeAlerts() // Compare with yesterday's broadcast
  });
}
```

---

## Alert Computation

```typescript
function computeAlerts(current: BroadcastData, previous?: BroadcastData): Alert[] {
  if (!previous) return [];
  
  const alerts: Alert[] = [];
  
  // New black sites
  const prevIds = new Set(previous.blackSites.map(b => b.sigintId));
  for (const site of current.blackSites) {
    if (!prevIds.has(site.sigintId)) {
      alerts.push({ type: 'NEW_BLACK_SITE', sigintId: site.sigintId, silentSector: site.silentSector });
    }
  }
  
  // Coverage shifts (>15pp change in any alignment share)
  // ... compare current vs previous radar top 20
  
  return alerts;
}
```

---

## Consumption Patterns

| Consumer | Method |
|----------|--------|
| Human (browser) | Visit `/numbers-station.html` |
| Human (email) | Subscribe → daily HTML email (planned) |
| Machine (CLI) | `curl https://zombie760.github.io/botwavebomba/api/numbers-station_latest.json \| jq` |
| Machine (bot) | Telegram bot polls JSON, posts to channel |
| Archive | `wget --mirror` daily snapshots |

---

## OpSec Notes

- **No client-side JS** — works in `curl`, `wget`, `lynx`, `links`, print-to-PDF
- **No external resources** — all CSS inlined, no fonts, no CDN
- **No cookies** — stateless
- **No analytics** — server logs only (GitHub Pages)
- **Static file** — can be hosted anywhere (IPFS, Tor, USB stick)
- **Versioned** — each broadcast has immutable ID `numbers-station-YYYY-MM-DD`

---

## Related

- [Black Site Detection](black-site-detection.md) — gap scoring
- [Radar Algorithm](radar-algorithm.md) — signal density
- [Spool](spool-algorithm.md) — temporal evolution