# Alignment Taxonomy — Three-Axis Geopolitical Classification

> **Core Principle**: We classify by *geopolitical alignment*, not domestic partisan lean. Left/Right is noise. Who owns the transmitter and what regime they answer to — that's signal.

---

## The Three Alignments

| Alignment | Definition | Typical Assets | State Relationship |
|-----------|------------|----------------|-------------------|
| **Western** | NATO/EU/US-aligned media ecosystems | BBC, NYT, DW, France24, Reuters, AP, CNN, Guardian, WaPost, Der Spiegel | Editorial independence formally protected; state funding (if any) at arm's length via public broadcasters |
| **Non-Aligned** | Global South, BRICS, neutral/alternative perspectives | Al Jazeera, RT en Español, Global Times, Telesur, The Hindu, Straits Times, Jakarta Post, Daily Maverick | Varies: state-funded but editorially distinct (Al Jazeera), state-aligned (Telesur), or commercially independent with regional focus |
| **Adversarial** | State media from regimes actively opposing Western bloc | RT, Sputnik, Press TV, CGTN, Tasnim, KCNA, Mehr, Fars, SANA | Direct state control; editorial line set by security apparatus; primary mission = narrative warfare |

---

## Why Not Left/Center/Right?

Domestic partisan spectrums **do not map** across borders:

- A "left-wing" outlet in Brazil (pro-Lula, pro-BRICS) aligns geopolitically with "right-wing" adversarial outlets (anti-NATO, anti-US hegemony)
- A "right-wing" outlet in Poland (pro-NATO, anti-Russia) aligns with "left-wing" Western outlets (pro-EU, pro-Ukraine)
- The *only* consistent predictor of framing on geopolitical stories: **which bloc the outlet's paymaster belongs to**

---

## Classification Method

### Inputs (per asset)

1. **Ownership structure** — State-owned? Private? Oligarch? Public trust? Listed?
2. **Funding % from state** — Direct appropriation, license fee, advertising from state enterprises
3. **Editorial control** — Independent board? Government-appointed director? Security service veto?
4. **Geopolitical consistency** — Test suite of 100+ tagged stories (Ukraine, Taiwan, Gaza, sanctions, BRICS, climate finance)
5. **Self-declaration** — Does the outlet describe itself as state media? (RT: "autonomous non-profit"; CGTN: "state media")

### Scoring

```
alignment_score = 
  0.40 * ownership_state_control
  0.25 * funding_state_share
  0.20 * editorial_independence_inverse
  0.15 * geopolitical_consistency
```

Thresholds:
- `≥ 0.65` → **Adversarial**
- `0.35–0.65` → **Non-Aligned**
- `< 0.35` → **Western**

### Re-evaluation

- Quarterly re-score on 50 new test stories
- Immediate re-review on: ownership change, editor purge, state crackdown, funding disclosure
- History preserved in `api/corrections.json` with before/after alignment

---

## Lean Rating (Within Alignment)

Separate from alignment, we apply **Left / Center / Right** *relative to the asset's own alignment bloc*:

| Alignment | "Left" Means | "Right" Means |
|-----------|--------------|---------------|
| Western | Pro-regulation, pro-redistribution, skeptical of intervention | Pro-market, pro-security, interventionist |
| Non-Aligned | Anti-imperialist, Global South solidarity, socialist-leaning | Nationalist, pro-sovereignty, traditionalist |
| Adversarial | Hardline regime loyalist, maximalist anti-West | Pragmatic regime voice, selective engagement |

**Key insight**: "Left" in Adversarial ≠ "Left" in Western. They're different coordinate systems.

---

## Vetting Rating (Credibility)

| Rating | Correction Rate | Primary Citation Rate | Anonymous Source Rate | IFCN Signatory |
|--------|-----------------|----------------------|----------------------|----------------|
| **HIGH** | < 5% | > 80% | < 15% | Yes (or equivalent) |
| **MIXED** | 5–15% | 40–80% | 15–30% | Sometimes |
| **LOW** | > 15% | < 40% | > 30% | No |

Sources: Public corrections pages, fact-check aggregators (IFCN, Duke Reporters' Lab), manual audit on 200-article sample per asset.

---

## Asset Registry Fields

Every asset in `api/sources_real_seed.json` carries:

```json
{
  "name": "Al Jazeera English",
  "bloc": "non-aligned",
  "country": "Qatar",
  "url": "https://www.aljazeera.com",
  "bias": "center",
  "factuality": "high",
  "tone": "neutral",
  "funding": "State-funded (Qatar Media Corporation)",
  "independence": "Editorial charter; board appointed by Emir but charter guarantees independence",
  "paywall": "Free",
  "language": "English",
  "ownership": "Qatar Media Corporation (state entity)"
}
```

---

## Transparency

- Full asset list: `/asset-registry` (HTML) + `/api/sources_real_seed.json` (machine)
- Classification history: `/api/corrections.json`
- Methodology details: [Tradecraft](tradecraft.md)
- Disagree with a classification? [Open an issue](https://github.com/Zombie760/botwave-bomba/issues/new?template=source_addition.md) with evidence.

---

## Quick Reference: Bloc Emoji Map

| Bloc | Emoji | CSS Class |
|------|-------|-----------|
| Western | 🟦 | `.western` |
| Non-Aligned | 🟨 | `.non-aligned` |
| Adversarial | 🟥 | `.adversarial` |
| Other/Unknown | ⬜ | `.other` |

Used in alignment bars, source badges, radar legend.