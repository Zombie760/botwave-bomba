// ── BWB API Adapter ──
// Maps the current data pipeline (stories_clustered.json + sources_real_seed.json +
// ownership.json) into the shape the feed renderer expects.
//
// Exposes window.BWB_API = { getLatest, getSources, getOwnership }
// so the rest of the frontend can stay stable even when the backend shape
// changes again.
(function () {
  'use strict';

  const BASE = window.BWB_BASE || '/botwavebomba';

  let latest = null;
  let sources = null;
  let ownership = null;
  let ownershipByDomain = {};

  function url(path) {
    return BASE + path;
  }

  async function fetchJson(path) {
    const res = await fetch(url(path), { cache: 'no-store' });
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    return res.json();
  }

  function normBloc(bloc) {
    const b = String(bloc || 'other').toLowerCase().replace(/_/g, '-');
    if (b === 'western') return 'western';
    if (b === 'non-aligned' || b === 'non_aligned' || b === 'nonaligned' || b === 'neutral') return 'non-aligned';
    if (b === 'adversarial') return 'adversarial';
    return 'other';
  }

  function biasToBucket(bias) {
    const b = String(bias || 'center').toLowerCase();
    if (b === 'left' || b === 'lean-left' || b === 'lean_left') return 'left';
    if (b === 'right' || b === 'lean-right' || b === 'lean_right') return 'right';
    return 'center';
  }

  function factualityFromSource(src) {
    return src.factfulness || src.factuality || 'unknown';
  }

  function getDomainFromUrl(u) {
    try {
      return new URL(u).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function mapSourceRow(s, idx) {
    const domain = s.domain || getDomainFromUrl(s.url) || '';
    const owner = ownershipByDomain[domain];
    return {
      id: s.name ? s.name.toLowerCase().replace(/\s+/g, '-') : 'src-' + idx,
      name: s.name || 'Unknown source',
      bloc: normBloc(s.bloc),
      country: s.country || '',
      url: s.url || s.primary_url || '',
      excerpt: s.excerpt || '',
      bias_bucket: biasToBucket(s.bias),
      bias_tier: s.bias || 'center',
      political_lean: s.bias || 'center',
      factuality: factualityFromSource(s),
      parent_company: owner ? owner.parent_company || owner.owner : '',
      primary_source_url: s.primary_source_url || '',
    };
  }

  function mapStory(raw) {
    const mappedSources = (raw.sources || []).map(mapSourceRow);

    const total = mappedSources.length || 1;
    const counts = { western: 0, 'non-aligned': 0, adversarial: 0, other: 0 };
    mappedSources.forEach(s => { counts[s.bloc] = (counts[s.bloc] || 0) + 1; });

    const left = mappedSources.filter(s => s.bias_bucket === 'left').length;
    const right = mappedSources.filter(s => s.bias_bucket === 'right').length;
    const center = mappedSources.filter(s => s.bias_bucket === 'center').length;

    const uniqueCountries = new Set(mappedSources.map(s => s.country).filter(Boolean));

    return {
      id: raw.id,
      headline: (raw.top_headlines && raw.top_headlines[0]) || 'Untitled story',
      summary: raw.framing_summary || raw.summary || '',
      section: raw.section || 'world',
      published: raw.generated_at || raw.published_at || new Date().toISOString(),
      sources: mappedSources,
      articles: mappedSources.slice(0, 6).map(s => ({
        url: s.url,
        source_name: s.name,
      })),
      coverage: {
        left_pct: Math.round((left / total) * 100),
        center_pct: Math.round((center / total) * 100),
        right_pct: Math.round((right / total) * 100),
        state_count: 0,
      },
      bloc_spread: counts,
      countries: Array.from(uniqueCountries),
      is_blindspot: Boolean(raw.is_blindspot),
      geo_frame: raw.geo_frame || '',
      geo_frame_label: raw.geo_frame_label || '',
      has_video: Boolean(raw.has_video),
      geo_gap: raw.geo_gap || {},
      low_confidence_count: raw.low_confidence_count || 0,
    };
  }

  function buildSources(sourcesJson) {
    return {
      generated_at: sourcesJson.generated_at,
      sources: (sourcesJson.sources || []).map((s, idx) => ({
        id: s.domain || 'src-' + idx,
        name: s.name,
        domain: s.domain,
        country: s.country,
        bloc: normBloc(s.bloc),
        bias: s.bias || 'center',
        political_lean: s.bias || 'center',
        factuality: s.factfulness || s.factuality || 'unknown',
        tone: s.tone,
        axis: {},
        parent_company: ownershipByDomain[s.domain] ? ownershipByDomain[s.domain].parent_company || ownershipByDomain[s.domain].owner : '',
        owner: ownershipByDomain[s.domain] ? ownershipByDomain[s.domain].owner : '',
        owner_type: ownershipByDomain[s.domain] ? ownershipByDomain[s.domain].owner_type : '',
        motive: ownershipByDomain[s.domain] ? ownershipByDomain[s.domain].motive : '',
        verified_at: s.verified_at,
        primary_source_url: s.primary_source_url,
      })),
    };
  }

  function buildLatest(storiesJson, sourcesJson) {
    return {
      generated_at: storiesJson.generated_at,
      stories: (storiesJson.stories || []).map(mapStory),
      sections: [
        { id: 'world', label: 'World' },
        { id: 'politics', label: 'Politics' },
        { id: 'conflict', label: 'Conflict' },
        { id: 'business', label: 'Business' },
      ],
      stats: {
        story_count: storiesJson.stories_count || (storiesJson.stories || []).length,
        source_count: sourcesJson.count || (sourcesJson.sources || []).length,
        generated_at: storiesJson.generated_at,
      },
    };
  }

  function ingestOwnership(ownershipJson) {
    ownership = Array.isArray(ownershipJson) ? { entries: ownershipJson } : ownershipJson;
    ownershipByDomain = {};
    const list = ownership && ownership.entries ? ownership.entries : (ownership || []);
    list.forEach(o => {
      if (o.domain) ownershipByDomain[o.domain] = o;
    });
  }

  function processPipeline(storiesJson, sourcesJson, ownershipJson) {
    ingestOwnership(ownershipJson);
    sources = buildSources(sourcesJson);
    latest = buildLatest(storiesJson, sourcesJson);
    return latest;
  }

  async function load() {
    if (latest) return latest;
    return loadFromApi();
  }

  async function loadFromApi() {
    const bootstrapUrl = url('/api/bootstrap');
    try {
      const boot = await fetchJson(bootstrapUrl);
      if (boot && boot.stories && boot.sources) {
        return processPipeline(boot, { sources: boot.sources, generated_at: boot.generated_at }, boot.ownership || []);
      }
    } catch (e) {
      console.warn('Bootstrap API failed, falling back:', e);
    }
    const [storiesJson, sourcesJson, ownershipJson] = await Promise.all([
      fetchJson('/api/stories_clustered.json'),
      fetchJson('/api/sources_real_seed.json'),
      fetchJson('/api/ownership.json'),
    ]);
    return processPipeline(storiesJson, sourcesJson, ownershipJson);
  }

  (function readBootstrap() {
    const el = document.getElementById('bwb-bootstrap-data');
    if (el) {
      try {
        const raw = el.textContent || '';
        const decoded = el.dataset.encoding === 'base64' ? atob(raw) : raw;
        const boot = JSON.parse(decoded);
        if (boot.stories && Array.isArray(boot.stories) && boot.sources && Array.isArray(boot.sources)) {
          processPipeline(boot, { sources: boot.sources, generated_at: boot.generated_at }, boot.ownership || []);
          return;
        }
      } catch (e) {
        console.warn('BWB bootstrap parse failed:', e);
      }
    }
    loadFromApi().catch(() => {});
  })();

  window.BWB_API = {
    async getLatest() {
      if (!latest) await load();
      return latest;
    },
    async getSources() {
      if (!sources) await load();
      return sources;
    },
    async getOwnership() {
      if (!ownership) await load();
      return ownership;
    },
    async refresh() {
      latest = null;
      sources = null;
      ownership = null;
      ownershipByDomain = {};
      return load();
    },
  };
})();
