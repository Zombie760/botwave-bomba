// ── BotwaveBomba Feed Renderer ──
// Renders story cards into #story-feed from BWB_API and wires the filters.
(function () {
  'use strict';

  const state = {
    stories: [],
    sources: [],
    activeFilters: {
      section: new Set(['all']),
      signal: new Set(['all']),
      geo: new Set(['all']),
      bias: new Set(['all']),
    },
  };

  const els = {
    storyFeed: document.getElementById('story-feed'),
    sectionNav: document.getElementById('section-nav'),
    filterNav: document.getElementById('filter-nav'),
    geoNav: document.getElementById('geo-nav'),
    biasNav: document.getElementById('bias-nav'),
    sectionPills: document.getElementById('section-pills'),
    frameStoryCount: document.getElementById('bwb-frame-story-count'),
    frameSourceCount: document.getElementById('bwb-frame-source-count'),
    frameCorpusAge: document.getElementById('bwb-frame-corpus-age'),
    liveText: document.getElementById('bwb-live-text'),
    liveDot: document.getElementById('bwb-live-dot'),
    cgStories: document.getElementById('bwb-cg-stories'),
    cgSources: document.getElementById('bwb-cg-sources'),
    cgCountries: document.getElementById('bwb-cg-countries'),
    cgSegW: document.getElementById('bwb-cg-seg-w'),
    cgSegN: document.getElementById('bwb-cg-seg-n'),
    cgSegA: document.getElementById('bwb-cg-seg-a'),
    cgBarLegend: document.getElementById('bwb-cg-bar-legend'),
    cgHeadline: document.getElementById('bwb-cg-headline'),
    cgDiversity: document.getElementById('bwb-cg-diversity'),
  };

  const BASE = window.BWB_BASE || '/botwavebomba';

  function classForBloc(bloc) {
    return bloc === 'non-aligned' ? 'non-aligned' : bloc;
  }

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

  function coverageBadge(story) {
    const srcs = story.sources || [];
    const counts = { western: 0, 'non-aligned': 0, adversarial: 0 };
    srcs.forEach(s => { counts[s.bloc] = (counts[s.bloc] || 0) + 1; });
    const chips = [];
    if (counts.western) chips.push(`<span class="bwb-bloc-pill western">${counts.western}W</span>`);
    if (counts['non-aligned']) chips.push(`<span class="bwb-bloc-pill non-aligned">${counts['non-aligned']}N</span>`);
    if (counts.adversarial) chips.push(`<span class="bwb-bloc-pill adversarial">${counts.adversarial}A</span>`);
    return chips.length ? chips.join(' ') : '<span class="bwb-bloc-pill other">unmapped</span>';
  }

  function buildCard(story) {
    const srcs = story.sources || [];
    const first = srcs[0] || {};
    const badges = [];
    if (story.is_blindspot) badges.push('<span class="bwb-story-card-blindspot blindspot">BLINDSPOT</span>');
    if (story.geo_frame === 'mono-frame') badges.push('<span class="bwb-story-card-blindspot mono-frame">MONO-FRAME</span>');
    if (story.geo_frame === 'blackout') badges.push('<span class="bwb-story-card-blindspot blackout">W. BLACKOUT</span>');

    return `
      <article class="bwb-story-card" data-story-id="${story.id}">
        <a href="${BASE}/story.html?id=${encodeURIComponent(story.id)}" class="bwb-story-card-link">
          <div class="bwb-story-card-header">
            <span class="bwb-story-source-initials ${classForBloc(first.bloc)}">${initials(first.name)}</span>
            <div class="bwb-story-bias-dot ${classForBloc(first.bloc)}"></div>
            <span class="bwb-story-source-name">${first.name || 'Unknown source'}</span>
            <span class="bwb-story-coverage">${coverageBadge(story)}</span>
          </div>
          <h3 class="bwb-story-card-title">${story.headline}</h3>
          <p class="bwb-story-card-snippet">${story.summary ? story.summary.slice(0, 180) + (story.summary.length > 180 ? '…' : '') : ''}</p>
          <div class="bwb-story-card-meta">
            <span class="bwb-story-card-time">${formatTimeAgo(story.published) || formatDate(story.published)}</span>
            <span class="bwb-story-card-count">${srcs.length} source${srcs.length === 1 ? '' : 's'}</span>
            ${badges.join('')}
          </div>
        </a>
      </article>
    `;
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

  function aggregateFactuality(sources) {
    const counts = { high: 0, mostly_factual: 0, medium: 0, mixed: 0, low: 0, unknown: 0 };
    (sources || []).forEach(s => {
      const f = String(s.factuality || 'unknown').toLowerCase();
      counts[f] = (counts[f] || 0) + 1;
    });
    const rated = counts.high + counts.mostly_factual + counts.medium + counts.mixed + counts.low;
    if (!rated) return { tone: 'unknown', label: '—' };
    if (counts.high + counts.mostly_factual >= 0.7 * rated) return { tone: 'high', label: 'High' };
    if (counts.low >= 0.3 * rated) return { tone: 'low', label: 'Low' };
    return { tone: 'mixed', label: 'Mixed' };
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

  function geoScope(story) {
    const countries = story.countries || [];
    if (countries.length > 10) return 'global';
    if (countries.length > 3) return 'regional';
    if (countries.length > 1) return 'national';
    return 'local';
  }

  function filteredStories() {
    return state.stories.filter(story => {
      const signals = storySignals(story);
      const sectionOk = state.activeFilters.section.has('all') || state.activeFilters.section.has(story.section);
      const signalOk = state.activeFilters.signal.has('all') || signals.some(s => state.activeFilters.signal.has(s));
      const geoOk = state.activeFilters.geo.has('all') || state.activeFilters.geo.has(geoScope(story));
      const biasOk = state.activeFilters.bias.has('all') || state.activeFilters.bias.has(story.coverageBias || 'center');
      return sectionOk && signalOk && geoOk && biasOk;
    });
  }

  function renderFeed() {
    if (!els.storyFeed) return;
    const stories = filteredStories();
    els.storyFeed.innerHTML = stories.map(buildCard).join('') || '<div class="bwb-empty">No stories match the active filters.</div>';
  }

  function renderSectionTabs() {
    if (!els.sectionNav) return;
    els.sectionNav.innerHTML = '<button class="active" data-filter="all">All</button>';
    const sections = [
      { id: 'world', label: 'World' },
      { id: 'politics', label: 'Politics' },
      { id: 'conflict', label: 'Conflict' },
      { id: 'business', label: 'Business' },
    ];
    sections.forEach(sec => {
      const btn = document.createElement('button');
      btn.textContent = sec.label;
      btn.dataset.filter = sec.id;
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
      btn.textContent = `${id} (${count})`;
      btn.dataset.filter = id;
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
    if (els.cgSegW) els.cgSegW.style.width = wPct + '%';
    if (els.cgSegN) els.cgSegN.style.width = nPct + '%';
    if (els.cgSegA) els.cgSegA.style.width = aPct + '%';
    if (els.cgBarLegend) {
      els.cgBarLegend.innerHTML =
        `<span class="bwb-bloc-bullet western"></span>Western ${wPct}% ` +
        `<span class="bwb-bloc-bullet non-aligned"></span>Non-Aligned ${nPct}% ` +
        `<span class="bwb-bloc-bullet adversarial"></span>Adversarial ${aPct}%`;
    }

    const biggest = blocs.western >= blocs['non-aligned'] && blocs.western >= blocs.adversarial
      ? ['Western', wPct]
      : blocs['non-aligned'] >= blocs.adversarial
      ? ['Non-Aligned', nPct]
      : ['Adversarial', aPct];
    const smallestPct = Math.min(wPct, nPct, aPct);
    const smallestName = smallestPct === wPct ? 'Western' : smallestPct === nPct ? 'Non-Aligned' : 'Adversarial';

    if (els.cgHeadline) {
      els.cgHeadline.innerHTML = `<strong>Today's coverage gap:</strong> ${biggest[0]} press leads at ${biggest[1]}%. ${smallestName} press trails at ${smallestPct}%. ${countries.size >= 10 ? `<strong>${countries.size} countries</strong> represented.` : `<strong>Only ${countries.size} countries</strong> — narrow geo spread.`}`;
    }

    const avgDiversity = Math.round(state.stories.reduce((sum, s) => sum + diversityScore(s), 0) / (state.stories.length || 1));
    if (els.cgDiversity) els.cgDiversity.textContent = avgDiversity;
  }

  function updateFrameStats() {
    if (els.frameStoryCount) els.frameStoryCount.textContent = `${state.stories.length} stories indexed`;
    if (els.frameSourceCount) els.frameSourceCount.textContent = `${state.sources.length} sources live`;
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
    append('section', state.activeFilters.section);
    append('signal', state.activeFilters.signal);
    append('geo', state.activeFilters.geo);
    append('bias', state.activeFilters.bias);
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
    state.activeFilters.section = parse('section');
    state.activeFilters.signal = parse('signal');
    state.activeFilters.geo = parse('geo');
    state.activeFilters.bias = parse('bias');
  }

  function bindToggle(nav, key, exclusive = true) {
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
      nav.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', state.activeFilters[key].has(b.dataset.filter));
      });
      renderFeed();
      updateUrlParams();
    });
  }

  function bindAll() {
    bindToggle(els.sectionNav, 'section', false);
    bindToggle(els.filterNav, 'signal', false);
    bindToggle(els.geoNav, 'geo', true);
    bindToggle(els.biasNav, 'bias', true);
    if (els.sectionPills) {
      els.sectionPills.addEventListener('click', e => {
        const btn = e.target.closest('button[data-filter]');
        if (!btn) return;
        state.activeFilters.section = new Set([btn.dataset.filter]);
        if (els.sectionNav) {
          els.sectionNav.querySelectorAll('button').forEach(b => {
            b.classList.toggle('active', state.activeFilters.section.has(b.dataset.filter));
          });
        }
        renderFeed();
        updateUrlParams();
      });
    }
  }

  function applyInitialActiveStates() {
    [
      [els.sectionNav, 'section', false],
      [els.filterNav, 'signal', false],
      [els.geoNav, 'geo', true],
      [els.biasNav, 'bias', true],
    ].forEach(([nav, key, exclusive]) => {
      if (!nav) return;
      nav.querySelectorAll('button').forEach(b => {
        b.classList.toggle('active', state.activeFilters[key].has(b.dataset.filter));
      });
    });
  }

  async function init() {
    if (!window.BWB_API) {
      if (els.storyFeed) els.storyFeed.innerHTML = '<div class="bwb-error-message">Feed data adapter not loaded.</div>';
      return;
    }
    readUrlParams();
    try {
      const latest = await window.BWB_API.getLatest();
      const sources = await window.BWB_API.getSources();
      state.stories = latest.stories || [];
      state.sources = sources.sources || [];
      state.generatedAt = latest.generated_at;

      // Derive a simple per-story coverage bias for the bias filter.
      state.stories.forEach(s => {
        const c = s.coverage || {};
        if (c.left_pct >= 60) s.coverageBias = 'left';
        else if (c.right_pct >= 60) s.coverageBias = 'right';
        else s.coverageBias = 'center';
      });

      renderSectionTabs();
      renderSectionPills();
      renderCoverageGap();
      updateFrameStats();
      updatePipelineStatus();
      applyInitialActiveStates();
      renderFeed();
      bindAll();
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
