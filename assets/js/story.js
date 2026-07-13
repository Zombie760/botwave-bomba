// Story detail hydration — loads story by ?id= from api/stories_clustered.json
(function () {
  'use strict';

  const BASE = window.BWB_BASE || '/botwavebomba';
  const mount = document.getElementById('story-detail-mount');
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  function url(path) {
    return path.startsWith('/') ? BASE + path : path;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function normBloc(bloc) {
    const b = String(bloc || 'other').toLowerCase().replace(/_/g, '-');
    if (b === 'western') return 'western';
    if (b === 'non-aligned' || b === 'nonaligned' || b === 'neutral') return 'non-aligned';
    if (b === 'adversarial') return 'adversarial';
    return 'other';
  }

  function renderBlocsBar(counts) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    const segs = ['western', 'non-aligned', 'adversarial', 'other']
      .map(k => {
        const pct = ((counts[k] || 0) / total) * 100;
        if (!pct) return '';
        return `<div class="bwb-blocs-seg ${k}" style="width:${pct.toFixed(2)}%"></div>`;
      }).join('');
    return `<div class="bwb-blocs-bar" aria-label="Source bloc mix">${segs || '<div class="bwb-blocs-seg other" style="width:100%"></div>'}</div>`;
  }

  function renderStory(story) {
    const counts = { western: 0, 'non-aligned': 0, adversarial: 0, other: 0 };
    for (const s of story.sources) counts[normBloc(s.bloc)] = (counts[normBloc(s.bloc)] || 0) + 1;

    const sourceRows = story.sources.map(s => {
      const bloc = normBloc(s.bloc);
      return `
        <li class="bwb-card-source-row ${bloc}">
          <span class="bwb-card-source-bloc ${bloc}"></span>
          <span class="bwb-card-source-name">${escapeHtml(s.name)}</span>
          <span class="bwb-card-source-country">${escapeHtml(s.country)}</span>
          <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">↗</a>
        </li>`;
    }).join('');

    const headlines = story.top_headlines.slice(0, 6).map((h, i) => {
      const s = story.sources[i];
      return `<li><strong>${escapeHtml(s ? s.name + ' · ' + s.country : 'Source ' + (i + 1))}</strong><br>${escapeHtml(h)}</li>`;
    }).join('');

    mount.innerHTML = `
      <article class="bwb-prose" style="max-width:860px;">
        <span class="bwb-section-kicker">Source comparison</span>
        <h1 style="font-size:var(--fs-3xl);">${escapeHtml(story.top_headlines[0] || 'Untitled')}</h1>
        <div class="bwb-hero-meta" style="margin-bottom:var(--space-5);">
          <span>${story.source_count || story.sources.length} sources</span>
          <span>${story.countries.length} countries</span>
        </div>
        ${renderBlocsBar(counts)}
        <h2>How sources framed it</h2>
        <ul style="padding-left:var(--space-5);">${headlines}</ul>
        <h2>All sources</h2>
        <ul style="list-style:none; padding:0;">${sourceRows}</ul>
        <p style="margin-top:var(--space-6);"><a href="${BASE}/">← Back to feed</a></p>
      </article>`;
  }

  if (!id) {
    mount.innerHTML = '<div class="bwb-empty"><h2>No story selected</h2><p>Use ?id=STORY_ID or return to the <a href="' + BASE + '/">homepage</a>.</p></div>';
    return;
  }

  fetch(url('/api/stories_clustered.json'))
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      const story = (data?.stories || []).find((s) => s.id === id);
      if (!story) {
        mount.innerHTML = '<div class="bwb-empty"><h2>Story not found</h2><p>This story may have expired or the ID is invalid. <a href="' + BASE + '/">Return home</a>.</p></div>';
        return;
      }
      renderStory(story);
    })
    .catch(() => {
      mount.innerHTML = '<div class="bwb-empty"><h2>Failed to load story</h2><p>Offline or data unavailable. <a href="' + BASE + '/offline.html">Offline page</a>.</p></div>';
    });
})();
