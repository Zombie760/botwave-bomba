# BotwaveBomba Design System

## Root-relative paths
All internal links, CSS, JS, JSON, and image paths must begin with `/botwavebomba/`.

## Theme
`<html lang="en" data-theme="auto">`. The `botwave.js` script reads `data-theme` and switches to `light` or `dark` based on system preference or localStorage.

## Typography
- Display/headlines: `var(--font-display)` (Georgia / serif stack)
- Body: `var(--font-body)` (Inter / system-ui)
- Mono/data: `var(--font-mono)` (DM Mono / monospace)

## Layout primitives
- `.bwb-page` — outer page wrapper, max-width `var(--max-w-grid)`, centered.
- `.bwb-prose` — long-form page body, max-width `var(--max-w-prose)`.
- `.bwb-layout` — main content area with optional sidebar.
- `.bwb-grid` — responsive story grid.

## Chrome

### Skip link
```html
<a class="bwb-skip-link" href="#main-content">Skip to content</a>
```

### Header
```html
<header class="bwb-site-header" role="banner">
  <div class="bwb-header-inner">
    <a class="bwb-wordmark" href="/botwavebomba/">BOTWAVE<span>BOMBA</span></a>
    <button class="bwb-menu-toggle" id="menuToggle" aria-label="Open menu" aria-expanded="false" aria-controls="primaryNav">
      <svg>...</svg>
    </button>
    <nav class="bwb-primary-nav" id="primaryNav" aria-label="Primary">
      <a href="/botwavebomba/" data-nav="home">Home</a>
      <a href="/botwavebomba/for-you.html" data-nav="for-you">For You</a>
      <a href="/botwavebomba/local.html" data-nav="local">Local</a>
      <a href="/botwavebomba/blindspot.html" data-nav="blindspot">Blindspot</a>
      <a href="/botwavebomba/world.html" data-nav="world">World</a>
      <a href="/botwavebomba/politics.html" data-nav="politics">Politics</a>
      <a href="/botwavebomba/conflict.html" data-nav="conflict">Conflict</a>
      <a href="/botwavebomba/business.html" data-nav="business">Business</a>
      <a href="/botwavebomba/tech.html" data-nav="tech">Tech</a>
      <a href="/botwavebomba/sports.html" data-nav="sports">Sports</a>
      <a href="/botwavebomba/corruption.html" data-nav="corruption">Corruption</a>
    </nav>
    <div class="bwb-header-actions">
      <button class="bwb-search-btn" id="searchToggle" aria-label="Search"><svg>...</svg></button>
      <button class="bwb-theme-btn" id="themeToggle" aria-label="Toggle theme"><span aria-hidden="true">🌙</span></button>
    </div>
  </div>
</header>
```

### Search overlay
```html
<div class="bwb-search-overlay" id="searchOverlay" hidden>
  <div class="bwb-search-inner">
    <input type="search" id="siteSearch" placeholder="Search stories, sources, countries…" autocomplete="off">
    <button id="searchClose" aria-label="Close search">Close</button>
  </div>
  <div class="bwb-search-results" id="searchResults"></div>
</div>
```

### Trending topics bar
```html
<div class="bwb-trending" aria-label="Trending topics">
  <span class="bwb-trending-label">Trending</span>
  <a href="/botwavebomba/world.html?q=iran">Iran</a>
  ...
  <button class="bwb-follow-btn" data-topic="...">Follow</button>
</div>
```

### Hero
```html
<section class="bwb-hero" aria-labelledby="hero-title">
  <div class="bwb-hero-inner">
    <div class="bwb-hero-text">
      <span class="bwb-hero-kicker">Featured story</span>
      <h1 id="hero-title">...</h1>
      <p class="bwb-hero-lead">...</p>
      <div class="bwb-hero-meta">
        <span class="bwb-source-count">N sources</span>
        <span class="bwb-country-count">N countries</span>
        <a class="bwb-hero-cta" href="/botwavebomba/story.html?id=...">Compare coverage →</a>
      </div>
      <div class="bwb-hero-sources">
        <article class="bwb-hero-source western"><cite>Source</cite><p>Headline</p></article>
        <article class="bwb-hero-source non-aligned"><cite>Source</cite><p>Headline</p></article>
        <article class="bwb-hero-source adversarial"><cite>Source</cite><p>Headline</p></article>
      </div>
    </div>
  </div>
</section>
```

### Story card
```html
<article class="bwb-story-card" data-sections="world conflict" data-filters="blindspot">
  <a class="bwb-story-card-link" href="/botwavebomba/story.html?id=..." aria-label="...">
    <div class="bwb-story-card-header">
      <span class="bwb-story-card-bloc western">Western</span>
      <span class="bwb-story-card-source">Source Name</span>
      <span class="bwb-story-card-country">US</span>
    </div>
    <h3 class="bwb-story-card-title">Headline</h3>
    <p class="bwb-story-card-excerpt">Excerpt</p>
    <div class="bwb-blocs-bar" aria-label="Source bloc mix">
      <div class="bwb-blocs-seg western" style="width:33%" data-label="Western 1"></div>
      <div class="bwb-blocs-seg non-aligned" style="width:50%" data-label="Non-Aligned 2"></div>
      <div class="bwb-blocs-seg adversarial" style="width:17%" data-label="Adversarial 1"></div>
    </div>
    <div class="bwb-story-card-meta">
      <span class="bwb-story-card-time">2h ago</span>
      <span>N sources</span>
      <span>N countries</span>
    </div>
  </a>
  <button class="bwb-card-expand" type="button" aria-expanded="false" aria-controls="sources-ID" data-expand="ID">Show N sources</button>
  <div class="bwb-card-sources" id="sources-ID" hidden>
    <ul>
      <li class="bwb-card-source-row western">
        <span class="bwb-card-source-name">Source</span>
        <span class="bwb-card-source-country">US</span>
        <a href="URL" target="_blank" rel="noopener">↗</a>
      </li>
    </ul>
  </div>
</article>
```

### Daily briefing
```html
<section class="bwb-briefing" aria-labelledby="briefing-title">
  <h2 id="briefing-title">Daily Briefing</h2>
  <p class="bwb-briefing-meta">N stories · M articles · K min read</p>
  <div class="bwb-briefing-list">
    <a href="/botwavebomba/story.html?id=..." class="bwb-briefing-item">
      <img src="/botwavebomba/assets/logos/default.png" alt="" loading="lazy">
      <div><h3>Headline</h3><p>Source count / blocs</p></div>
    </a>
  </div>
  <a href="/botwavebomba/brief.html" class="bwb-briefing-more">Full briefing →</a>
</section>
```

### Section page header
```html
<div class="bwb-section-header">
  <span class="bwb-section-kicker">Section</span>
  <h1>World</h1>
  <p>Global stories across Western, Non-Aligned, and Adversarial blocs.</p>
</div>
```

### Footer
```html
<footer class="bwb-site-footer" role="contentinfo">
  <div class="bwb-footer-inner">
    <div class="bwb-footer-brand">BOTWAVEBOMBA</div>
    <nav aria-label="Footer">
      <a href="/botwavebomba/methodology.html">Methodology</a>
      <a href="/botwavebomba/sources.html">Sources</a>
      <a href="/botwavebomba/corrections.html">Corrections</a>
      <a href="/botwavebomba/pro.html">Pricing</a>
    </nav>
    <p class="bwb-footer-tagline">Not Left/Right. Who Owns The Story.</p>
  </div>
</footer>
```

## Color tokens (light)
- `--color-bg: #FAFAF7`
- `--color-bg-elevated: #FFFFFF`
- `--color-bg-inset: #F2F2EE`
- `--color-text: #1A1A1A`
- `--color-text-strong: #000000`
- `--color-text-muted: #6B6B6B`
- `--color-border: #E0E0DA`
- `--color-accent: #D94E1E` (rust/orange)
- `--color-accent-hover: #B33D14`
- `--color-accent-text: #FFFFFF`
- `--color-western: #4A6FA5`
- `--color-non-aligned: #D94E1E`
- `--color-adversarial: #8E2B2B`

## Dark tokens
- `--color-bg: #121212`
- `--color-bg-elevated: #1E1E1E`
- `--color-bg-inset: #2A2A2A`
- `--color-text: #E8E8E8`
- `--color-text-strong: #FFFFFF`
- `--color-text-muted: #A0A0A0`
- `--color-border: #333333`
- accent same
