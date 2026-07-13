// ── BotwaveBomba Feed Renderer v4 ──
// Renders story cards into #story-feed from BWB_API and wires the filters.
// New: Horizontal desktop cards, mobile filter drawer, animated coverage gap, brief CTA cards.
(function () {
  'use strict';

  const BASE = window.BWB_BASE || '/botwavebomba';

  const FILTER_CONFIG = [
    { key: 'section', nav: 'section-nav', mobileNav: 'filter-drawer-signal', multi: true },
    { key: 'signal', nav: 'filter-nav', mobileNav: 'filter-drawer-signal', multi: true },
    { key: 'bloc', nav: 'bloc-nav', mobileNav: 'filter-drawer-bloc', multi: false },
    { key: 'region', nav: 'region-nav', mobileNav: 'filter-drawer-region', multi: false },
    { key: 'geo', nav: 'geo-nav', mobileNav: 'filter-drawer-geo', multi: false },
    { key: 'date', nav: 'date-nav', mobileNav: 'filter-drawer-date', multi: false },
    { key: 'bias', nav: 'bias-nav', mobileNav: 'filter-drawer-bias', multi: false },
  ];

  const state = {
    stories: [],
    sources: [],
    ownershipByDomain: {},
    activeFilters: Object.fromEntries(FILTER_CONFIG.map(c => [c.key, new Set(['all'])])),
    sort: 'score',
    drawerOpen: false,
  };

  const els = {
    storyFeed: document.getElementById('story-feed'),
    sectionNav: document.getElementById('section-nav'),
    filterNav: document.getElementById('filter-nav'),
    blocNav: document.getElementById('bloc-nav'),
    regionNav: document.getElementById('region-nav'),
    geoNav: document.getElementById('geo-nav'),
    dateNav: document.getElementById('date-nav'),
    biasNav: document.getElementById('bias-nav'),
    sectionPills: document.getElementById('section-pills'),
    sortNav: document.getElementById('sort-nav'),
    briefCta: document.getElementById('brief-cta'),
    frameStoryCount: document.getElementById('bwb-frame-story-count'),
    frameSourceCount: document.getElementById('bwb-frame-source-count'),
    frameCorpusAge: document.getElementById('bwb-frame-corpus-age'),
    liveText: document.getElementById('bwb-live-text'),
    liveDot: document.getElementById('bwb-live-dot'),
    cgStories: document.getElementById('bwb-cg-stories'),
    cgSources: document.getElementById('bwb-cg-sources'),
    cgCountries: document.getElementById('bwb-cg-countries'),
    cgDiversity: document.getElementById('bwb-cg-diversity'),
    cgSegW: document.getElementById('bwb-cg-seg-w'),
    cgSegN: document.getElementById('bwb-cg-seg-n'),
    cgSegA: document.getElementById('bwb-cg-seg-a'),
    cgBarLegend: document.getElementById('bwb-cg-bar-legend'),
    cgHeadline: document.getElementById('bwb-cg-headline'),
    // Mobile drawer
    filterTrigger: document.getElementById('filter-trigger'),
    filterTriggerCount: document.getElementById('filter-trigger-count'),
    filterDrawer: document.getElementById('filter-drawer'),
    filterDrawerBackdrop: document.getElementById('filter-drawer-backdrop'),
    filterDrawerClose: document.getElementById('filter-drawer-close'),
    filterDrawerClearAll: document.getElementById('filter-drawer-clear-all'),
    filterDrawerApply: document.getElementById('filter-drawer-apply'),
  };

  // ── Region mapping: country code → region slug(s) ──
  const COUNTRY_REGIONS = (() => {
    const map = {};
    const add = (codes, region) => codes.forEach(c => { (map[c] ||= new Set()).add(region); });
    add(['AE','BH','DZ','EG','IQ','IR','JO','KW','LB','LY','MA','OM','PS','QA','SA','SD','SY','TN','TR','YE'], 'mena');
    add(['AR','BO','BR','CL','CO','CR','CU','DO','EC','SV','GT','HN','MX','NI','PA','PY','PE','PR','UY','VE'], 'latam');
    add(['AO','BJ','BW','BF','BI','CM','CV','CF','TD','KM','CD','CG','CI','DJ','GQ','ER','ET','GA','GM','GH','GN','GW','KE','LS','LR','MG','MW','ML','MR','MU','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','SZ','TZ','TG','UG','ZM','ZW'], 'ssa');
    add(['CN','HK','JP','KR','KP','MN','MO','TW'], 'east-asia');
    add(['AD','AL','AT','BA','BE','BG','CH','CY','CZ','DE','DK','EE','ES','FI','FR','GB','GR','HR','HU','IE','IS','IT','LT','LU','LV','MC','MD','ME','MK','MT','NL','NO','PL','PT','RO','RS','RU','SE','SI','SK','SM','UA','VA'], 'europe');
    add(['CA','US','MX'], 'north-america');
    return map;
  })();

  function classForBloc(bloc) { return bloc === 'non-aligned' ? 'non-aligned' : bloc; }

  function initials(name) {
    const clean = String(name || '').replace(/^(The|A)\s+/i, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  }

  function formatTimeAgo(ts) {
    const t = Date.parse(ts);
    if (isNaN(t)) return '';
    const mins = Math.floor((Date.now() - t) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    return Math.floor(hours / 24) + 'd ago';
  }

  function formatDate(ts) {
    const t = Date.parse(ts);
    if (isNaN(t)) return '';
    return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  function getDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
  }

  function buildOwnershipMap(ownership) {
    const list = ownership?.entries || (Array.isArray(ownership) ? ownership : []);
    state.ownershipByDomain = {};
    list.forEach(o => { if (o.domain) state.ownershipByDomain[o.domain] = o; });
  }

  function ownerForSource(source) {
    const domain = source.domain || getDomain(source.url);
    return state.ownershipByDomain[domain];
  }

  function cardGradient(id) {
    const h = hashString(id);
    const hue1 = h % 360;
    const hue2 = (h * 13) % 360;
    return `linear-gradient(135deg, oklch(50% 0.18 ${hue1}), oklch(40% 0.15 ${hue2}))`;
  }

  function coverageCounts(story) {
    const srcs = story.sources || [];
    const counts = { western: 0, 'non-aligned': 0, adversarial: 0 };
    srcs.forEach(s => { counts[s.bloc] = (counts[s.bloc] || 0) + 1; });
    return counts;
  }

  function coverageBadge(story) {
    const counts = coverageCounts(story);
    const chips = [];
    if (counts.western) chips.push(`<span class="bwb-bloc-pill western">${counts.western}W</span>`);
    if (counts['non-aligned']) chips.push(`<span class="bwb-bloc-pill non-aligned">${counts['non-aligned']}N</span>`);
    if (counts.adversarial) chips.push(`<span class="bwb-bloc-pill adversarial">${counts.adversarial}A</span>`);
    return chips.length ? chips.join(' ') : '<span class="bwb-bloc-pill other">unmapped</span>';
  }

  function blocsBar(story) {
    const counts = coverageCounts(story);
    const total = Math.max(1, counts.western + counts['non-aligned'] + counts.adversarial);
    return `
      <div class="bwb-blocs-bar" aria-label="Source bloc mix">
        <div class="bwb-blocs-seg western" style="width:${(counts.western / total) * 100}%" data-label="Western ${counts.western}"></div>
        <div class="bwb-blocs-seg non-aligned" style="width:${(counts['non-aligned'] / total) * 100}%" data-label="Non-Aligned ${counts['non-aligned']}"></div>
        <div class="bwb-blocs-seg adversarial" style="width:${(counts.adversarial / total) * 100}%" data-label="Adversarial ${counts.adversarial}"></div>
      </div>
    `;
  }

  function sourceListHtml(story) {
    const srcs = story.sources || [];
    if (!srcs.length) return '';
    return `
      <div class="bwb-card-sources" id="sources-${story.id}" hidden>
        <ul>
          ${srcs.map(s => {
            const o = ownerForSource(s);
            const ownerLine = o?.owner ? `<span class="bwb-card-source-owner" title="${o.owner_type || 'owner'}${o.parent_company ? ' \u00b7 parent: ' + o.parent_company : ''}${o.motive ? ' \u00b7 ' + o.motive : ''}">${o.owner}</span>` : '';
            return `
            <li class="bwb-card-source-row">
              <span class="bwb-card-source-bloc ${classForBloc(s.bloc)}"></span>
              <span class="bwb-card-source-name">${s.name || 'Unknown'}</span>
              ${ownerLine}
              ${s.country ? `<span class="bwb-card-source-country">${s.country}</span>` : ''}
              <a href="${s.url || '#'}" target="_blank" rel="noopener" class="bwb-card-source-link">\u2197</a>
            </li>`;
          }).join('')}
        </ul>
      </div>
    `;
  }

  function aggregateFactuality(sources) {
    const counts = { high: 0, mostly_factual: 0, medium: 0, mixed: 0, low: 0, unknown: 0 };
    (sources || []).forEach(s => {
      const f = String(s.factuality || s.factfulness || 'unknown').toLowerCase();
      counts[f] = (counts[f] || 0) + 1;
    });
    const rated = counts.high + counts.mostly_factual + counts.medium + counts.mixed + counts.low;
    if (!rated) return { tone: 'unknown', label: '\u2014' };
    if (counts.high + counts.mostly_factual >= 0.7 * rated) return { tone: 'high', label: 'High factuality' };
    if (counts.low >= 0.3 * rated) return { tone: 'low', label: 'Low factuality' };
    return { tone: 'mixed', label: 'Mixed factuality' };
  }

  function factualityBadge(story) {
    const f = aggregateFactuality(story.sources);
    return `<span class="bwb-story-card-factuality ${f.tone}">${f.label}</span>`;
  }

  function entropy(counts) {
    const total = counts.western + counts['non-aligned'] + counts.adversarial;
    if (!total) return 0;
    let e = 0;
    [counts.western, counts['non-aligned'], counts.adversarial].forEach(n => {
      if (n > 0) { const p = n / total; e -= p * Math.log2(p); }
    });
    return e;
  }

  function scoreForStory(story) {
    if (typeof story._score === 'number') return story._score;
    const counts = coverageCounts(story);
    const total = counts.western + counts['non-aligned'] + counts.adversarial;
    if (!total) { story._score = 0; return 0; }
    const nonWestPct = ((counts['non-aligned'] + counts.adversarial) / total);
    const ent = entropy(counts);
    const score = nonWestPct * ent * Math.log2(total + 1);
    story._score = Math.round(score * 100) / 100;
    return story._score;
  }

  function storyRegions(story) {
    const set = new Set();
    (story.countries || []).forEach(c => {
      (COUNTRY_REGIONS[c] || new Set()).forEach(r => set.add(r));
    });
    return Array.from(set);
  }

  function dateFilterOk(story, filter) {
    const t = Date.parse(story.published);
    if (isNaN(t)) return false;
    const hours = (Date.now() - t) / 3600000;
    if (filter === 'today') return hours <= 24;
    if (filter === '3d') return hours <= 72;
    if (filter === '7d') return hours <= 168;
    return true;
  }

  function geoScope(story) {
    const countries = story.countries || [];
    if (countries.length > 10) return 'global';
    if (countries.length > 3) return 'regional';
    if (countries.length > 1) return 'national';
    return 'local';
  }

  function storySignals(story) {
    const out = [];
    if (story.is_blindspot) out.push('blindspot');
    if (story.geo_frame === 'mono-frame') out.push('mono-frame');
    if (story.geo_frame === 'blackout') out.push('blackout');
    if (story.has_video) out.push('has-video');
    const c = story.coverage || {};
    if ((c.left_pct || 0) >= 60) out.push('left-heavy');
    if ((c.right_pct || 0) >= 60) out.push('right-heavy');
    const factTone = aggregateFactuality(story.sources).tone;
    if (factTone === 'high') out.push('fact-high');
    if (factTone === 'mixed') out.push('fact-mixed');
    if (factTone === 'low') out.push('fact-low');
    return out;
  }

  // ── Card Renderer ──
  function buildCard(story) {
    const srcs = story.sources || [];
    const first = srcs[0] || {};
    const firstOwner = ownerForSource(first);
    const ownerChip = firstOwner?.owner
      ? `<span class="bwb-owner-chip" title="Owned by ${firstOwner.owner}">${firstOwner.owner}</span>`
      : '';
    const badges = [];
    if (story.is_blindspot) badges.push('<span class="bwb-signal-badge blindspot">Blindspot</span>');
    if (story.geo_frame === 'mono-frame') badges.push('<span class="bwb-signal-badge mono-frame">Mono-frame</span>');
    if (story.geo_frame === 'blackout') badges.push('<span class="bwb-signal-badge blackout">W. Blackout</span>');

    const logoUrl = first.domain ? `https://logo.clearbit.com/${first.domain}` : '';
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="bwb-story-card-logo-fallback">${initials(first.name)}</span>`
      : `<span class="bwb-story-card-logo-fallback">${initials(first.name)}</span>`;

    return `
      <article class="bwb-story-card" data-story-id="${story.id}">
        <a href="${BASE}/story.html?id=${encodeURIComponent(story.id)}" class="bwb-story-card-link" aria-label="Read full coverage of: ${story.headline}">
          <!-- Column 1: Logo + Source + Bloc + Factuality -->
          <div class="bwb-story-card-header">
            <div class="bwb-story-card-logo">${logoHtml}</div>
            <span class="bwb-story-card-source-name">${first.name || 'Unknown source'}</span>
            <span class="bwb-story-card-bloc ${classForBloc(first.bloc)}">${first.bloc === 'western' ? 'Western' : first.bloc === 'adversarial' ? 'Adversarial' : 'Non-Aligned'}</span>
            ${factualityBadge(story)}
          </div>

          <!-- Column 2: Headline + Excerpt + Blocs Bar + Meta -->
          <h3 class="bwb-story-card-title">${story.headline}</h3>
          <p class="bwb-story-card-excerpt">${story.summary ? story.summary.slice(0, 180) + (story.summary.length > 180 ? '\u2026' : '') : ''}</p>

          <div class="bwb-story-card-blocs">${blocsBar(story)}</div>

          <div class="bwb-story-card-meta">
            <span class="bwb-story-card-time">${formatTimeAgo(story.published) || formatDate(story.published)}</span>
            <div class="bwb-story-card-counts">
              <span class="bwb-story-card-count">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                ${srcs.length} source${srcs.length === 1 ? '' : 's'}
              </span>
              <span class="bwb-story-card-count">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                ${(story.countries || []).length} countr${(story.countries || []).length === 1 ? 'y' : 'ies'}
              </span>
            </div>
            <div class="bwb-story-card-badges">${badges.join('')}</div>
          </div>
        </a>

        <button class="bwb-card-expand" type="button" aria-expanded="false" aria-controls="sources-${story.id}" data-expand="${story.id}">
          <span class="bwb-card-expand-label">show ${srcs.length} sources</span>
        </button>
        ${sourceListHtml(story)}
      </article>
    `;
  }

  // ── Filtering & Sorting ──
  function filteredStories() {
    const list = state.stories.filter(story => {
      const signals = storySignals(story);
      const counts = coverageCounts(story);
      const regions = storyRegions(story);

      const sectionOk = state.activeFilters.section.has('all') || state.activeFilters.section.has(story.section);
      const signalOk = state.activeFilters.signal.has('all') || signals.some(s => state.activeFilters.signal.has(s));
      const blocFilter = state.activeFilters.bloc.values().next().value;
      const blocOk = state.activeFilters.bloc.has('all') || (counts[blocFilter] > 0);
      const regionFilter = state.activeFilters.region.values().next().value;
      const regionOk = state.activeFilters.region.has('all') || regions.some(r => state.activeFilters.region.has(r));
      const geoFilter = state.activeFilters.geo.values().next().value;
      const geoOk = state.activeFilters.geo.has('all') || state.activeFilters.geo.has(geoScope(story));
      const dateFilter = state.activeFilters.date.values().next().value;
      const dateOk = state.activeFilters.date.has('all') || dateFilterOk(story, dateFilter);
      const biasFilter = state.activeFilters.bias.values().next().value;
      const biasOk = state.activeFilters.bias.has('all') || state.activeFilters.bias.has(story.coverageBias || 'center');

      return sectionOk && signalOk && blocOk && regionOk && geoOk && dateOk && biasOk;
    });

    return list.sort((a, b) => {
      if (state.sort === 'score') return scoreForStory(b) - scoreForStory(a);
      if (state.sort === 'sources') return (b.sources || []).length - (a.sources || []).length;
      if (state.sort === 'freshness') return new Date(b.published || 0) - new Date(a.published || 0);
      return 0;
    });
  }

  function renderFeed() {
    if (!els.storyFeed) return;
    const stories = filteredStories();
    if (!stories.length) {
      els.storyFeed.innerHTML = `
        <div class="bwb-empty bwb-text-clamp-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          No stories match the active filters.
          <a class="bwb-empty-action" href="#" onclick="event.preventDefault();document.querySelectorAll('.bwb-filter-btn.active, .bwb-section-pill.active, .bwb-sort-btn.active').forEach(b=>{b.classList.remove('active');if(b.dataset.filter==='all')b.classList.add('active');});window.location.reload();">Clear all filters</a>
        </div>
      `;
      return;
    }
    els.storyFeed.innerHTML = stories.map(buildCard).join('');
  }

  function renderSectionTabs() {
    if (!els.sectionNav) return;
    els.sectionNav.innerHTML = '';
    const sections = [
      { id: 'all', label: 'All' },
      { id: 'world', label: 'World' },
      { id: 'politics', label: 'Politics' },
      { id: 'conflict', label: 'Conflict' },
      { id: 'business', label: 'Business' },
    ];
    sections.forEach(sec => {
      const btn = document.createElement('button');
      btn.className = 'bwb-section-pill';
      btn.textContent = sec.label;
      btn.dataset.section = sec.id;
      if (state.activeFilters.section.has(sec.id)) btn.classList.add('active');
      els.sectionNav.appendChild(btn);
    });
  }

  function renderSectionPills() {
    if (!els.sectionPills) return;
    els.sectionPills.innerHTML = '';
    const counts = {};
    state.stories.forEach(s => { counts[s.section] = (counts[s.section] || 0) + 1; });
    Object.entries(counts).forEach(([id, count]) => {
      const btn = document.createElement('button');
      btn.className = 'bwb-section-pill';
      btn.textContent = `${id} (${count})`;
      btn.dataset.section = id;
      if (state.activeFilters.section.has(id)) btn.classList.add('active');
      els.sectionPills.appendChild(btn);
    });
  }

  function renderCoverageGap() {
    const allSrcs = state.stories.flatMap(s => s.sources || []);
    const countries = new Set(allSrcs.map(s => s.country).filter(Boolean));
    const blocs = { western: 0, 'non-aligned': 0, adversarial: 0, other: 0 };
    allSrcs.forEach(s => { blocs[s.bloc] = (blocs[s.bloc] || 0) + 1; });
    const total = blocs.western + blocs['non-aligned'] + blocs.adversarial + blocs.other || 1;
    const wPct = Math.round((blocs.western / total) * 100);
    const nPct = Math.round((blocs['non-aligned'] / total) * 100);
    const aPct = Math.round((blocs.adversarial / total) * 100);

    if (els.cgStories) els.cgStories.textContent = state.stories.length.toLocaleString();
    if (els.cgSources) els.cgSources.textContent = allSrcs.length.toLocaleString();
    if (els.cgCountries) els.cgCountries.textContent = countries.size.toLocaleString();

    // Animate bar segments
    const animateSeg = (el, pct, label) => {
      if (!el) return;
      el.style.width = '0%';
      el.dataset.label = label;
      requestAnimationFrame(() => { el.style.width = pct + '%'; });
    };
    animateSeg(els.cgSegW, wPct, `Western ${wPct}%`);
    animateSeg(els.cgSegN, nPct, `Non-Aligned ${nPct}%`);
    animateSeg(els.cgSegA, aPct, `Adversarial ${aPct}%`);

    if (els.cgBarLegend) {
      els.cgBarLegend.innerHTML = `
        <span class="bwb-bloc-bullet western"></span>Western ${wPct}%
        <span class="bwb-bloc-bullet non-aligned"></span>Non-Aligned ${nPct}%
        <span class="bwb-bloc-bullet adversarial"></span>Adversarial ${aPct}%
      `;
    }

    const biggest = blocs.western >= blocs['non-aligned'] && blocs.western >= blocs.adversarial
      ? ['Western', wPct]
      : blocs['non-aligned'] >= blocs.adversarial
        ? ['Non-Aligned', nPct]
        : ['Adversarial', aPct];
    const smallestPct = Math.min(wPct, nPct, aPct);
    const smallestName = smallestPct === wPct ? 'Western' : smallestPct === nPct ? 'Non-Aligned' : 'Adversarial';

    if (els.cgHeadline) {
      els.cgHeadline.innerHTML = `<strong>Today's coverage gap:</strong> ${biggest[0]} press leads at ${biggest[1]}%. ${smallestName} press trails at ${smallestPct}%. ${countries.size >= 10 ? `<strong>${countries.size} countries</strong> represented.` : `<strong>Only ${countries.size} countries</strong> \u2014 narrow geo spread.`}`;
    }

    const avgDiversity = Math.round(state.stories.reduce((sum, s) => sum + diversityScore(s), 0) / (state.stories.length || 1));
    if (els.cgDiversity) els.cgDiversity.textContent = avgDiversity;
  }

  function diversityScore(story) {
    const srcs = story.sources || [];
    if (srcs.length < 2) return 0;
    const left = srcs.filter(s => s.bias_bucket === 'left').length;
    const right = srcs.filter(s => s.bias_bucket === 'right').length;
    const center = srcs.filter(s => s.bias_bucket === 'center').length;
    const n = srcs.length;
    const c = (left / n) ** 2 + (center / n) ** 2 + (right / n) ** 2;
    const lcr = Math.max(0, Math.min(1, (1 - c) / 0.67)) * 50;
    const blocs = new Set(srcs.map(s => s.bloc)).size;
    const blocPart = (blocs / 3) * 50;
    return Math.round(lcr + blocPart);
  }

  function updateFrameStats() {
    if (els.frameStoryCount) els.frameStoryCount.textContent = state.stories.length.toLocaleString();
    if (els.frameSourceCount) els.frameSourceCount.textContent = state.sources.length.toLocaleString();
    if (els.frameCorpusAge && state.generatedAt) {
      els.frameCorpusAge.textContent = 'corpus ' + formatTimeAgo(state.generatedAt);
      els.frameCorpusAge.title = 'Corpus generated ' + new Date(state.generatedAt).toUTCString();
    }
  }

  function updatePipelineStatus() {
    if (els.liveText) els.liveText.textContent = 'pipeline LIVE';
    if (els.liveDot) els.liveDot.classList.add('live');
  }

  function updateUrlParams() {
    const params = new URLSearchParams();
    const append = (key, set) => {
      if (!set.has('all')) {
        const vals = Array.from(set).filter(v => v !== 'all');
        if (vals.length) params.set(key, vals.join(','));
      }
    };
    FILTER_CONFIG.forEach(c => append(c.key, state.activeFilters[c.key]));
    if (state.sort && state.sort !== 'score') params.set('sort', state.sort);
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }

  function readUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const parse = key => {
      const val = params.get(key);
      if (!val) return new Set(['all']);
      return new Set(['all', ...val.split(',').filter(Boolean)]);
    };
    FILTER_CONFIG.forEach(c => { state.activeFilters[c.key] = parse(c.key); });
    const sortVal = params.get('sort');
    state.sort = ['score', 'sources', 'freshness'].includes(sortVal) ? sortVal : 'score';
  }

  function bindToggle(nav, key, exclusive) {
    if (!nav) return;
    nav.addEventListener('click', e => {
      const btn = e.target.closest('button[data-filter]');
      if (!btn) return;
      const filter = btn.dataset.filter;
      const set = state.activeFilters[key];
      if (exclusive) {
        state.activeFilters[key] = new Set([filter]);
      } else {
        if (filter === 'all') {
          state.activeFilters[key] = new Set(['all']);
        } else {
          set.delete('all');
          set.has(filter) ? set.delete(filter) : set.add(filter);
          if (!set.size) set.add('all');
        }
      }
      // Sync both desktop and mobile
      [nav, document.getElementById(FILTER_CONFIG.find(c => c.key === key)?.mobileNav || '')].forEach(n => {
        if (!n) return;
        n.querySelectorAll('button').forEach(b => {
          b.classList.toggle('active', state.activeFilters[key].has(b.dataset.filter));
        });
      });
      renderFeed();
      updateUrlParams();
      updateFilterTriggerCount();
    });
  }

  function bindSort() {
    if (!els.sortNav) return;
    els.sortNav.addEventListener('click', e => {
      const btn = e.target.closest('button[data-sort]');
      if (!btn) return;
      state.sort = btn.dataset.sort;
      els.sortNav.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', b.dataset.sort === state.sort);
      });
      renderFeed();
      updateUrlParams();
    });
  }

  function bindCardExpands() {
    if (!els.storyFeed) return;
    els.storyFeed.addEventListener('click', e => {
      const btn = e.target.closest('button[data-expand]');
      if (!btn) return;
      const id = btn.dataset.expand;
      const panel = document.getElementById(`sources-${id}`);
      if (!panel) return;
      e.preventDefault();
      const expanded = panel.hidden;
      panel.hidden = !expanded;
      btn.setAttribute('aria-expanded', String(expanded));
      const label = btn.querySelector('.bwb-card-expand-label');
      if (label) {
        const count = (state.stories.find(s => s.id === id)?.sources || []).length;
        label.textContent = expanded ? `hide ${count} sources` : `show ${count} sources`;
      }
    });
  }

  function bindSectionTabs() {
    if (!els.sectionNav) return;
    els.sectionNav.addEventListener('click', e => {
      const btn = e.target.closest('.bwb-section-pill[data-section]');
      if (!btn) return;
      state.activeFilters.section = new Set([btn.dataset.section]);
      // Sync section pills
      els.sectionNav.querySelectorAll('.bwb-section-pill').forEach(b => {
        b.classList.toggle('active', state.activeFilters.section.has(b.dataset.section));
      });
      if (els.sectionPills) {
        els.sectionPills.querySelectorAll('.bwb-section-pill').forEach(b => {
          b.classList.toggle('active', state.activeFilters.section.has(b.dataset.section));
        });
      }
      renderFeed();
      updateUrlParams();
    });
  }

  function bindSectionPills() {
    if (!els.sectionPills) return;
    els.sectionPills.addEventListener('click', e => {
      const btn = e.target.closest('.bwb-section-pill[data-section]');
      if (!btn) return;
      state.activeFilters.section = new Set([btn.dataset.section]);
      if (els.sectionNav) {
        els.sectionNav.querySelectorAll('.bwb-section-pill').forEach(b => {
          b.classList.toggle('active', state.activeFilters.section.has(b.dataset.section));
        });
      }
      renderFeed();
      updateUrlParams();
    });
  }

  function applyInitialActiveStates() {
    FILTER_CONFIG.forEach(c => {
      const nav = c.nav ? document.getElementById(c.nav) : null;
      const mobileNav = c.mobileNav ? document.getElementById(c.mobileNav) : null;
      [nav, mobileNav].forEach(n => {
        if (!n) return;
        n.querySelectorAll('button[data-filter]').forEach(b => {
          b.classList.toggle('active', state.activeFilters[c.key].has(b.dataset.filter));
        });
      });
    });
    if (els.sortNav) {
      els.sortNav.querySelectorAll('button[data-sort]').forEach(b => {
        b.classList.toggle('active', b.dataset.sort === state.sort);
      });
    }
  }

  // ── Mobile Filter Drawer ──
  function toggleDrawer(open) {
    state.drawerOpen = open;
    els.filterDrawer.classList.toggle('open', open);
    els.filterDrawerBackdrop.classList.toggle('open', open);
    els.filterTrigger.setAttribute('aria-expanded', String(open));
    els.filterDrawerBackdrop.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  function updateFilterTriggerCount() {
    if (!els.filterTriggerCount) return;
    let total = 0;
    FILTER_CONFIG.forEach(c => {
      const set = state.activeFilters[c.key];
      if (!set.has('all')) total += set.size;
    });
    els.filterTriggerCount.textContent = total;
    els.filterTriggerCount.style.display = total ? 'inline-flex' : 'none';
  }

  function bindDrawer() {
    if (!els.filterTrigger || !els.filterDrawer || !els.filterDrawerBackdrop) return;

    els.filterTrigger.addEventListener('click', () => toggleDrawer(!state.drawerOpen));
    els.filterDrawerBackdrop.addEventListener('click', () => toggleDrawer(false));
    els.filterDrawerClose?.addEventListener('click', () => toggleDrawer(false));
    els.filterDrawerApply?.addEventListener('click', () => toggleDrawer(false));

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && state.drawerOpen) toggleDrawer(false);
    });

    // Clear all filters
    els.filterDrawerClearAll?.addEventListener('click', () => {
      FILTER_CONFIG.forEach(c => {
        state.activeFilters[c.key] = new Set(['all']);
        const nav = c.nav ? document.getElementById(c.nav) : null;
        const mobileNav = c.mobileNav ? document.getElementById(c.mobileNav) : null;
        [nav, mobileNav].forEach(n => {
          if (!n) return;
          n.querySelectorAll('button[data-filter]').forEach(b => {
            b.classList.toggle('active', b.dataset.filter === 'all');
          });
        });
      });
      renderFeed();
      updateUrlParams();
      updateFilterTriggerCount();
    });

    // Mobile filter buttons (inside drawer)
    FILTER_CONFIG.forEach(c => {
      const mobileNav = c.mobileNav ? document.getElementById(c.mobileNav) : null;
      if (mobileNav) bindToggle(mobileNav, c.key, !c.multi);
    });

    // Sidebar section toggles (desktop)
    document.querySelectorAll('.bwb-sidebar-section-title').forEach(title => {
      title.addEventListener('click', () => {
        title.closest('.bwb-sidebar-section').classList.toggle('collapsed');
      });
    });
  }

  // ── Brief CTA ──
  async function renderBriefCta() {
    if (!els.briefCta) return;
    try {
      const index = await fetch(`${BASE}/daily/index.json`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null);
      if (!index || !index.latest) return;
      const summary = await fetch(`${BASE}/daily/${index.latest}.json`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null);
      if (!summary || !summary.picks || !summary.picks.length) return;
      const picks = summary.picks.slice(0, 3).map(p => `
        <a class="bwb-brief-cta-pick" href="${BASE}/story.html?id=${encodeURIComponent(p.id)}">
          <span class="bwb-brief-cta-rank">#${p.rank}</span>
          <span class="bwb-brief-cta-headline">${(p.headline || 'Untitled').replace(/</g, '<')}</span>
          <span class="bwb-brief-cta-pill">${p.sources} sources \u00b7 ${p.non_west_pct}% non-West</span>
        </a>
      `).join('');
      const body = els.briefCta.querySelector('.bwb-brief-cta-body');
      const link = els.briefCta.querySelector('.bwb-brief-cta-link');
      if (body) body.outerHTML = `<div class="bwb-brief-cta-picks">${picks}</div>`;
      if (link) link.textContent = `Read the ${summary.date} brief \u2192`;
    } catch (e) {
      console.warn('Brief CTA load failed:', e);
    }
  }

  // ── Init ──
  async function init() {
    if (!window.BWB_API) {
      if (els.storyFeed) els.storyFeed.innerHTML = '<div class="bwb-error-message">Feed data adapter not loaded.</div>';
      return;
    }
    readUrlParams();
    try {
      const [latest, sources, ownership] = await Promise.all([
        window.BWB_API.getLatest(),
        window.BWB_API.getSources(),
        window.BWB_API.getOwnership(),
      ]);
      state.stories = latest.stories || [];
      state.sources = sources.sources || [];
      state.generatedAt = latest.generated_at;
      buildOwnershipMap(ownership);

      state.stories.forEach(s => {
        const c = s.coverage || {};
        if (c.left_pct >= 60) s.coverageBias = 'left';
        else if (c.right_pct >= 60) s.coverageBias = 'right';
        else s.coverageBias = 'center';
        scoreForStory(s);
      });

      renderSectionTabs();
      renderSectionPills();
      renderCoverageGap();
      updateFrameStats();
      updatePipelineStatus();
      applyInitialActiveStates();
      renderFeed();
      bindToggle(els.sectionNav, 'section', true);
      FILTER_CONFIG.forEach(c => bindToggle(c.nav ? document.getElementById(c.nav) : null, c.key, !c.multi));
      bindSort();
      bindCardExpands();
      bindSectionTabs();
      bindSectionPills();
      bindDrawer();
      renderBriefCta();
      updateFilterTriggerCount();
    } catch (err) {
      console.error('Feed init failed:', err);
      if (els.storyFeed) els.storyFeed.innerHTML = `<div class="bwb-error-message">Failed to load stories: ${err.message}</div>`;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();