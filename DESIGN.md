# BotwaveBomba Design Specification

> **Status**: v2.0 — Professional News Product
> **Last Updated**: 2026-07-13
> **Platforms**: Web (GitHub Pages), Progressive Enhancement
> **Design System**: OKLCH-native, Dark-mode-first, WCAG AA

---

## 1. Color System

### 1.1 Primitive Palette (OKLCH)

All primitives defined in OKLCH for perceptual uniformity. Values are lightness-chroma-hue.

```css
:root {
  /* Neutral Ink Scale — warm gray, readable in both modes */
  --ink-0:    oklch(98.5% 0.003 85);
  --ink-50:   oklch(96%   0.006 85);
  --ink-100:  oklch(92%   0.01  85);
  --ink-200:  oklch(86%   0.014 85);
  --ink-300:  oklch(78%   0.018 85);
  --ink-400:  oklch(68%   0.02  85);
  --ink-500:  oklch(56%   0.02  85);
  --ink-600:  oklch(46%   0.02  85);
  --ink-700:  oklch(36%   0.02  85);
  --ink-800:  oklch(26%   0.02  85);
  --ink-900:  oklch(18%   0.02  85);
  --ink-950:  oklch(12%   0.02  85);

  /* Brand Accent — purple, distinct from bloc colors */
  --accent-hue: 285;
  --accent-300: oklch(78% 0.12 var(--accent-hue));
  --accent-400: oklch(66% 0.18 var(--accent-hue));
  --accent-500: oklch(52% 0.22 var(--accent-hue));
  --accent-600: oklch(46% 0.24 var(--accent-hue));
  --accent-700: oklch(38% 0.22 var(--accent-hue));

  /* Bloc Colors — perceptually balanced, not raw primaries */
  --bloc-western-hue:      25;   /* warm red */
  --bloc-western-chroma:   0.22;
  --bloc-western-light:    0.52;
  --bloc-nonaligned-hue:   195;  /* teal */
  --bloc-nonaligned-chroma: 0.18;
  --bloc-nonaligned-light: 0.58;
  --bloc-adversarial-hue:  295;  /* purple-blue */
  --bloc-adversarial-chroma: 0.20;
  --bloc-adversarial-light: 0.54;

  --bloc-western:      oklch(var(--bloc-western-light)   var(--bloc-western-chroma)   var(--bloc-western-hue));
  --bloc-non-aligned:  oklch(var(--bloc-nonaligned-light) var(--bloc-nonaligned-chroma) var(--bloc-nonaligned-hue));
  --bloc-adversarial:  oklch(var(--bloc-adversarial-light) var(--bloc-adversarial-chroma) var(--bloc-adversarial-hue));

  /* Semantic Status */
  --status-positive-hue: 145;
  --status-positive: oklch(58% 0.16 var(--status-positive-hue));
  --status-warning-hue:  85;
  --status-warning: oklch(72% 0.18 var(--status-warning-hue));
  --status-error-hue: 25;
  --status-error: oklch(56% 0.22 var(--status-error-hue));
  --status-info-hue: 240;
  --status-info: oklch(56% 0.18 var(--status-info-hue));

  /* Factuality */
  --fact-high: var(--status-positive);
  --fact-mixed: var(--status-warning);
  --fact-low: var(--status-error);
  --fact-unknown: var(--ink-400);
}
```

### 1.2 Semantic Aliases (What Components Use)

```css
:root {
  /* Surfaces */
  --color-bg:           var(--ink-0);
  --color-bg-elevated:  var(--ink-50);
  --color-bg-sunken:    var(--ink-100);
  --color-bg-overlay:   oklch(0% 0 0 / 0.5);

  /* Text */
  --color-text:           var(--ink-900);
  --color-text-strong:    var(--ink-950);
  --color-text-muted:     var(--ink-500);
  --color-text-subtle:    var(--ink-300);
  --color-text-inverse:   var(--ink-0);
  --color-text-on-accent: var(--ink-0);

  /* Borders */
  --color-border:         oklch(0% 0 0 / 0.08);
  --color-border-strong:  oklch(0% 0 0 / 0.16);
  --color-border-focus:   var(--color-accent);

  /* Accent (Brand) */
  --color-accent:         var(--accent-500);
  --color-accent-hover:   var(--accent-600);
  --color-accent-soft:    var(--accent-300);
  --color-accent-text:    var(--color-text-on-accent);

  /* Bloc — Semantic */
  --color-bloc-western:      var(--bloc-western);
  --color-bloc-non-aligned:  var(--bloc-non-aligned);
  --color-bloc-adversarial:  var(--bloc-adversarial);

  /* Status — Semantic */
  --color-positive: var(--status-positive);
  --color-warning:  var(--status-warning);
  --color-error:    var(--status-error);
  --color-info:     var(--status-info);

  /* Factuality — Semantic */
  --color-fact-high:    var(--fact-high);
  --color-fact-mixed:   var(--fact-mixed);
  --color-fact-low:     var(--fact-low);
  --color-fact-unknown: var(--fact-unknown);

  /* Shadows / Elevation */
  --elevation-0: none;
  --elevation-1: 0 1px 2px  oklch(0% 0 0 / 0.05), 0 1px 3px  oklch(0% 0 0 / 0.03);
  --elevation-2: 0 4px 8px  oklch(0% 0 0 / 0.06), 0 2px 4px  oklch(0% 0 0 / 0.04);
  --elevation-3: 0 8px 24px oklch(0% 0 0 / 0.08), 0 4px 12px oklch(0% 0 0 / 0.05);
  --elevation-4: 0 16px 48px oklch(0% 0 0 / 0.10), 0 8px 24px oklch(0% 0 0 / 0.06);

  /* Focus Ring */
  --focus-ring: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-accent);
}

/* ─── Dark Mode — Not Inverted, Perceptually Matched ─── */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ink-0:    oklch(12%  0.003 85);
    --ink-50:   oklch(16%  0.006 85);
    --ink-100:  oklch(22%  0.01  85);
    --ink-200:  oklch(28%  0.014 85);
    --ink-300:  oklch(38%  0.018 85);
    --ink-400:  oklch(52%  0.02  85);
    --ink-500:  oklch(64%  0.02  85);
    --ink-600:  oklch(72%  0.02  85);
    --ink-700:  oklch(80%  0.02  85);
    --ink-800:  oklch(88%  0.02  85);
    --ink-900:  oklch(94%  0.02  85);
    --ink-950:  oklch(97%  0.02  85);

    /* Bloc colors lighten in dark mode for perceptual parity */
    --bloc-western-light:     0.58;
    --bloc-nonaligned-light:  0.62;
    --bloc-adversarial-light: 0.60;

    /* Shadows disappear in dark mode — use borders instead */
    --elevation-1: 0 0 0 1px oklch(100% 0 0 / 0.06);
    --elevation-2: 0 0 0 1px oklch(100% 0 0 / 0.10);
    --elevation-3: 0 0 0 1px oklch(100% 0 0 / 0.12);
    --elevation-4: 0 0 0 1px oklch(100% 0 0 / 0.16);
  }
}

[data-theme="light"] {
  /* Force light — use :root defaults */
}

[data-theme="dark"] {
  /* Force dark — use media query values */
  --ink-0:    oklch(12%  0.003 85);
  --ink-50:   oklch(16%  0.006 85);
  --ink-100:  oklch(22%  0.01  85);
  --ink-200:  oklch(28%  0.014 85);
  --ink-300:  oklch(38%  0.018 85);
  --ink-400:  oklch(52%  0.02  85);
  --ink-500:  oklch(64%  0.02  85);
  --ink-600:  oklch(72%  0.02  85);
  --ink-700:  oklch(80%  0.02  85);
  --ink-800:  oklch(88%  0.02  85);
  --ink-900:  oklch(94%  0.02 85);
  --ink-950:  oklch(97%  0.02 85);

  --bloc-western-light:     0.58;
  --bloc-nonaligned-light:  0.62;
  --bloc-adversarial-light: 0.60;

  --elevation-1: 0 0 0 1px oklch(100% 0 0 / 0.06);
  --elevation-2: 0 0 0 1px oklch(100% 0 0 / 0.10);
  --elevation-3: 0 0 0 1px oklch(100% 0 0 / 0.12);
  --elevation-4: 0 0 0 1px oklch(100% 0 0 / 0.16);
}
```

---

## 2. Typography

### 2.1 Font Stacks

```css
:root {
  --font-editorial: 'Playfair Display', Georgia, Cambria, 'Times New Roman', serif;
  --font-ui:        'DM Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono:      'DM Mono', ui-monospace, 'SF Mono', 'Fira Mono', Menlo, monospace;
}
```

### 2.2 Fluid Type Scale (clamp)

```css
:root {
  /* Display / Hero */
  --fs-display: clamp(2.5rem, 5vw, 4rem);      /* 40px–64px */
  --fs-h1:      clamp(2rem,   3.5vw, 3rem);    /* 32px–48px */
  --fs-h2:      clamp(1.5rem, 2.5vw, 2.25rem); /* 24px–36px */
  --fs-h3:      clamp(1.25rem, 2vw, 1.75rem);  /* 20px–28px */

  /* Body */
  --fs-lg:   clamp(1.125rem, 1.5vw, 1.25rem);  /* 18px–20px */
  --fs-base: clamp(1rem, 1.2vw, 1.125rem);     /* 16px–18px */
  --fs-sm:   clamp(0.875rem, 1vw, 1rem);       /* 14px–16px */
  --fs-xs:   clamp(0.75rem, 0.8vw, 0.875rem);  /* 12px–14px */
  --fs-2xs:  0.6875rem;                         /* 11px — fixed, labels only */

  /* Line Heights */
  --lh-tight:  1.15;
  --lh-snug:   1.3;
  --lh-normal: 1.55;
  --lh-loose:  1.7;

  /* Weights */
  --fw-normal:  400;
  --fw-medium:  500;
  --fw-semibold: 600;
  --fw-bold:    700;
}
```

### 2.3 Usage Rules

| Element | Font | Size | Weight | Line Height |
|---------|------|------|--------|-------------|
| Hero headline | `--font-editorial` | `--fs-display` | `--fw-bold` | `--lh-tight` |
| Section headings | `--font-editorial` | `--fs-h2` | `--fw-semibold` | `--lh-snug` |
| Story card title | `--font-editorial` | `--fs-h3` | `--fw-bold` | `--lh-snug` |
| Body copy | `--font-ui` | `--fs-base` | `--fw-normal` | `--lh-normal` |
| Meta/data labels | `--font-mono` | `--fs-2xs` | `--fw-medium` | `--lh-normal` |
| Button text | `--font-ui` | `--fs-sm` | `--fw-semibold` | `--lh-normal` |
| Caption/microcopy | `--font-ui` | `--fs-xs` | `--fw-normal` | `--lh-normal` |

---

## 3. Spacing System

```css
:root {
  --space-0: 0;
  --space-1: 4px;    /* 0.25rem */
  --space-2: 8px;    /* 0.5rem */
  --space-3: 12px;   /* 0.75rem */
  --space-4: 16px;   /* 1rem */
  --space-5: 24px;   /* 1.5rem */
  --space-6: 32px;   /* 2rem */
  --space-7: 48px;   /* 3rem */
  --space-8: 64px;   /* 4rem */
  --space-9: 96px;   /* 6rem */
  --space-10: 128px; /* 8rem */

  /* Gutters */
  --gutter-mobile: var(--space-4);
  --gutter-tablet: var(--space-5);
  --gutter-desktop: var(--space-6);

  /* Container Max Widths */
  --max-w-prose: 680px;   /* Article body */
  --max-w-feed: 1080px;   /* Feed grid */
  --max-w-grid: 1200px;   /* Dashboard */
  --max-w-bleed: 1440px;  /* Full-bleed sections */
}
```

---

## 4. Border Radius

```css
:root {
  --radius-none: 0;
  --radius-sm: 4px;    /* Chips, badges */
  --radius-md: 8px;    /* Buttons, inputs */
  --radius-lg: 12px;   /* Cards, panels */
  --radius-xl: 16px;   /* Modals, sheets */
  --radius-2xl: 24px;  /* Hero elements */
  --radius-pill: 999px; /* Pills, avatars */
}
```

---

## 5. Motion System

```css
:root {
  /* Durations */
  --dur-instant: 0ms;
  --dur-fast:    120ms;  /* Hover, focus, simple transitions */
  --dur-base:    200ms;  /* Standard UI transitions */
  --dur-slow:    320ms;  /* Complex state changes */
  --dur-slower:  480ms;  /* Page transitions, drawers */

  /* Easings */
  --ease-linear:     linear;
  --ease-out:        cubic-bezier(0.16, 1, 0.3, 1);      /* Default — natural deceleration */
  --ease-in-out:     cubic-bezier(0.65, 0, 0.35, 1);     /* Modal, drawer */
  --ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1);  /* Playful, bouncy */
  --ease-sharp:      cubic-bezier(0.4, 0, 0.6, 1);       /* Quick, decisive */

  /* Reduced Motion */
  --dur-fast-reduced:    0ms;
  --dur-base-reduced:    0ms;
  --dur-slow-reduced:    0ms;
  --dur-slower-reduced:  0ms;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-fast:    var(--dur-fast-reduced);
    --dur-base:    var(--dur-base-reduced);
    --dur-slow:    var(--dur-slow-reduced);
    --dur-slower:  var(--dur-slower-reduced);
  }
}
```

---

## 6. Z-Index Scale

```css
:root {
  --z-base:       1;      /* Default content */
  --z-dropdown:   100;    /* Dropdowns, popovers */
  --z-sticky:     200;    /* Sticky headers, filters */
  --z-drawer:     300;    /* Mobile filter drawer */
  --z-modal:      400;    /* Modals, dialogs */
  --z-toast:      500;    /* Toasts, notifications */
  --z-tooltip:    600;    /* Tooltips */
}
```

---

## 7. Breakpoints

```css
:root {
  --bp-sm:  480px;   /* Mobile */
  --bp-md:  768px;   /* Tablet */
  --bp-lg:  1024px;  /* Desktop */
  --bp-xl:  1280px;  /* Wide desktop */
  --bp-2xl: 1536px;  /* Ultra-wide */
}
```

---

## 8. Component Specifications

### 8.1 Story Card (Feed)

```
┌─────────────────────────────────────────────────────────────┐
│  [Outlet Logo]  Outlet Name          [Bloc Badge]  [Fact]  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  HEADLINE (Playfair)                   │  │
│  │  Excerpt text... (DM Sans, 2 lines clamp)              │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ████████████░░░░░░░░░░░░░  Western 42% Non-Aligned 38%  │  │
│  │  Bloc Bar (animated on load)                           │  │
│  └───────────────────────────────────────────────────────┘  │
│  [Time]  [17 sources]  [14 countries]  [Blindspot Badge]    │
└─────────────────────────────────────────────────────────────┘
```

**States**: Default, Hover (elevation-2), Focus (focus-ring), Expanded (source list), Skeleton (loading)

**Responsive**:
- Desktop (≥768px): Horizontal — logo+meta left, headline+excerpt right, bloc bar full width
- Mobile: Vertical stack, bloc bar under headline

### 8.2 Filter System

**Desktop**: Collapsible sections in sticky sidebar, chevron toggle, active count badge
**Mobile**: Bottom sheet (drawer) with grab handle, sections as accordions, "Clear all" + "Apply" sticky footer

```css
.bwb-filter-drawer {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  max-height: 85vh;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  background: var(--color-bg-elevated);
  box-shadow: var(--elevation-4);
  z-index: var(--z-drawer);
  transform: translateY(100%);
  transition: transform var(--dur-slow) var(--ease-out);
}
.bwb-filter-drawer.open { transform: translateY(0); }
```

### 8.3 Coverage Gap Bar

```css
.bwb-coverage-gap-bar {
  height: 32px;
  border-radius: var(--radius-pill);
  background: var(--color-bg-sunken);
  overflow: hidden;
  position: relative;
}
.bwb-coverage-gap-seg {
  height: 100%;
  transition: width var(--dur-slow) var(--ease-out);
}
.bwb-coverage-gap-seg::after {
  content: attr(data-label);
  position: absolute;
  /* centered in segment, text-shadow for contrast */
}
```

### 8.4 Source Row (Story Detail)

```
┌────────────────────────────────────────────────────────────────┐
│ [Logo]  Outlet Name        [Bloc]  [Country]  [Owner Chip]     │
│ ─────────────────────────────────────────────────────────────  │
│  Excerpt text...                                               │
│  [Read at source →]                    [Ownership: Owner →    │
│                                                      Parent ·  │
│                                                      Motive]   │
└────────────────────────────────────────────────────────────────┘
```

### 8.5 Ownership Panel (Story Detail Sidebar)

```
┌────────────────────────────────────────────┐
│  WHO PAID FOR THE FRAMING?                 │
│  ────────────────────────────────────────  │
│  📰 Outlet Name                            │
│  👤 Owner: Thomson Reuters Corporation     │
│  🏢 Parent: Thomson Reuters Corporation    │
│  🎯 Motive: Subscription/licensing revenue │
│  🔗 [Evidence]  [Verify]                   │
│                                            │
│  25/17 outlets have ownership data        │
│  [Upgrade to Vantage for full registry]   │
└────────────────────────────────────────────┘
```

### 8.6 Bias Radar Chart (Story Detail)

5-axis radar (interventionist, zionist, atlanticist, statist, financialized) — built with SVG, no external deps. Each axis 0–100. Story shows as filled polygon; bloc average as stroke.

---

## 9. Accessibility (WCAG 2.2 AA)

| Requirement | Implementation |
|-------------|----------------|
| Contrast (text) | All semantic pairs ≥ 4.5:1 (verified via OKLCH lightness deltas) |
| Contrast (UI) | Borders, focus rings, icons ≥ 3:1 |
| Focus Visible | `--focus-ring` on all interactive elements |
| Keyboard | All filters, cards, drawers operable via Tab/Enter/Space/Escape |
| ARIA | `role="feed"`, `aria-label` on filters, `aria-expanded` on drawers, `aria-live="polite"` on coverage gap |
| Reduced Motion | `@media (prefers-reduced-motion)` disables all transitions |
| Skip Link | `.bwb-skip-link` — first focusable element |
| Landmarks | `<header role="banner">`, `<nav role="navigation">`, `<main role="main">`, `<aside role="complementary">` |

---

## 10. Font Loading (Google Fonts)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

## 11. CSS Architecture

```css
@layer reset, tokens, base, layout, components, utilities, overrides;
```

- **reset**: Modern reset (box-sizing, margins, list-style, button/input normalization)
- **tokens**: This DESIGN.md → tokens.css (primitives + semantic aliases)
- **base**: html/body, type scale, focus-visible, selection
- **layout**: Container, grid, sidebar, drawer
- **components**: Card, button, badge, pill, bar, drawer, modal, table, form
- **utilities**: Visually-hidden, container, text-clamp, skeleton
- **overrides**: Page-specific tweaks (minimal)

---

## 12. Migration Checklist

- [ ] Replace `theme.css` legacy vars with semantic aliases
- [ ] Update `tokens.css` to v2 spec
- [ ] Rewrite `feed.css` using component specs
- [ ] Update `index.html` font loads, markup structure
- [ ] Rewrite `feed.js` card renderer, filter drawer
- [ ] Update `story.html` with ownership panel, radar chart
- [ ] Verify dark mode perceptual parity
- [ ] Run WCAG AA audit (axe-core)
- [ ] Performance: LCP < 2.5s, CLS < 0.1, TBT < 200ms

---

## 13. Design Tokens Export (JSON)

For Figma/Tailwind/Style Dictionary sync:

```json
{
  "color": {
    "ink": { "0": "#fafaf7", "50": "#f3f3ef", "100": "#e7e7dd", "200": "#dcdccf", "300": "#c8c8bc", "400": "#acaca6", "500": "#8f8f88", "600": "#75756e", "700": "#5d5d56", "800": "#484842", "900": "#32322d", "950": "#21211c" },
    "accent": { "300": "#d6c8f0", "400": "#b89de0", "500": "#9266d0", "600": "#7a4ec4", "700": "#643db0" },
    "bloc": { "western": "#e07b5e", "non-aligned": "#5ec4d1", "adversarial": "#a87cd1" },
    "semantic": { "positive": "#5ec98a", "warning": "#e8c95e", "error": "#e06b5e", "info": "#6b8fe8" }
  },
  "font": { "editorial": "Playfair Display", "ui": "DM Sans", "mono": "DM Mono" },
  "spacing": { "1": "4px", "2": "8px", "3": "12px", "4": "16px", "5": "24px", "6": "32px", "7": "48px", "8": "64px" },
  "radius": { "sm": "4px", "md": "8px", "lg": "12px", "xl": "16px", "2xl": "24px", "pill": "999px" },
  "shadow": { "1": "0 1px 2px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.03)", "2": "0 4px 8px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04)", "3": "0 8px 24px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)", "4": "0 16px 48px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.06)" },
  "motion": { "fast": "120ms", "base": "200ms", "slow": "320ms", "slower": "480ms", "ease-out": "cubic-bezier(0.16,1,0.3,1)", "ease-in-out": "cubic-bezier(0.65,0,0.35,1)", "ease-spring": "cubic-bezier(0.34,1.56,0.64,1)" }
}
```

---

*Generated by BotwaveBomba Design Council — implement verbatim for Ground News parity.*