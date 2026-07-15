"""
Spike 001: cluster-bridge

Validate that we can take articles_*.jsonl + the bias-fingerprinted source
registry and emit stories_clustered.json in the site schema the loader
expects (id, bloc_spread, source_count, top_headlines, sources[]).

Input:
  /var/home/gringo/Botwave-Master/Telos/substrate/bomba_sources/articles_*.jsonl
  /var/home/gringo/Botwave-Master/Telos/substrate/bomba_sources/claims.jsonl
  /var/home/gringo/Botwave-Master-Consolidated/ARMS/bomba-mobile/zombie760.github.io/botwavebomba/data/source_registry.json
  /var/home/gringo/Botwave-Master-Consolidated/ARMS/business/Business/ContentEngine/news_crawler/sources_master.json

Output (spike only — written to spike dir, not the live site):
  /var/home/gringo/botwave-bomba/spikes/001-cluster-bridge/stories_clustered.json

Clustering approach (cheap heuristic, intended to be replaced):
  1) Extract proper-noun entities (capitalized spans) from each article title + summary
  2) For each pair of articles: if they share >=1 entity OR share a country + share a topic word → same cluster
  3) For each cluster, compute:
       - bloc_spread from sources' bias axes
       - countries (unique ISO codes)
       - top_headlines (top 5 unique titles by frequency)
       - sources[] (deduped, with bloc derived from 6-axis bias fingerprint)
  4) Emit in site schema (legacy aliases: bloc_spread, source_count, top_headlines, primary_urls)

Bloc derivation from 6-axis bias:
  western:        bias_western + bias_atlanticist + bias_interventionist > 1.5
  adversarial:    bias_adversarial > 0.5
  non_aligned:    default
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ARTICLES_DIR = Path("/var/home/gringo/Botwave-Master/Telos/substrate/bomba_sources")
ARTICLES_GLOB = ARTICLES_DIR  # glob() in load_articles() walks this dir
CLAIMS = Path("/var/home/gringo/Botwave-Master/Telos/substrate/bomba_sources/claims.jsonl")
REGISTRY = Path("/var/home/gringo/Botwave-Master-Consolidated/ARMS/bomba-mobile/zombie760.github.io/botwavebomba/data/source_registry.json")
MASTER = Path("/var/home/gringo/Botwave-Master-Consolidated/ARMS/business/Business/ContentEngine/news_crawler/sources_master.json")
OUT = Path("/var/home/gringo/botwave-bomba/spikes/001-cluster-bridge/stories_clustered.json")

# Cheap stopword set for entity extraction
STOPWORDS = {
    "the", "a", "an", "in", "on", "at", "to", "for", "of", "and", "or", "but",
    "is", "are", "was", "were", "be", "been", "being", "as", "by", "with",
    "from", "this", "that", "these", "those", "it", "its", "his", "her",
    "their", "our", "your", "my", "we", "you", "they", "he", "she", "i",
    "have", "has", "had", "do", "does", "did", "will", "would", "should",
    "could", "may", "might", "must", "can", "shall", "after", "before",
    "over", "under", "up", "down", "out", "into", "than", "then", "so",
    "if", "not", "no", "yes", "all", "any", "some", "more", "most", "less",
    "least", "very", "just", "only", "also", "even", "still", "now", "new",
    "old", "first", "last", "next", "says", "said", "told", "tell", "tells",
    "amid", "during", "between", "among", "about", "because", "while", "when",
    "where", "how", "why", "what", "who", "whom", "which", "where",
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "per", "via",
}

# Topic words for secondary clustering signal
TOPIC_WORDS = {
    "war", "ceasefire", "strike", "strikes", "talks", "troops", "sanctions",
    "tariff", "tariffs", "trade", "election", "vote", "votes", "protest",
    "crisis", "deal", "agreement", "summit", "missile", "military", "naval",
    "border", "hostage", "prisoner", "court", "verdict", "ruling",
    "killed", "death", "died", "dies", "shooting", "bombing", "explosion",
    "sanction", "embargo", "blockade", "nuclear", "weapon", "weapons",
    "diplomacy", "diplomat", "negotiation", "treaty", "summit", "g7", "g20",
    "un", "nato", "eu", "opec", "imf", "ai", "crypto", "inflation", "rates",
    "fed", "central", "bank", "merger", "acquisition", "ipo", "earnings",
    "revenue", "stock", "stocks", "bond", "bonds", "yield", "yields",
    "oil", "gas", "energy", "ship", "ships", "vessel", "vessels", "port",
    "ports", "strait", "hormuz", "red sea", "black sea", "suez",
    "israel", "iran", "russia", "ukraine", "china", "taiwan", "gaza",
    "lebanon", "syria", "yemen", "iraq", "saudi", "turkey", "qatar",
    "hamas", "hezbollah", "houthi", "kremlin", "white house", "pentagon",
    "reuters", "associated press", "bbc",
}

PROPER_NOUN_RE = re.compile(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b")
WORD_RE = re.compile(r"\b[a-z]{4,}\b")


def load_articles() -> list[dict]:
    out = []
    for p in sorted(ARTICLES_GLOB.glob("articles_*.jsonl")):
        if p.stat().st_size == 0:
            continue
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                a = json.loads(line)
            except json.JSONDecodeError:
                continue
            if a.get("type") != "bomba_article":
                continue
            out.append(a)
    return out


def load_claims() -> dict[str, dict]:
    """source_id -> {id, name, country_code, tier, source_type}"""
    if not CLAIMS.exists():
        return {}
    out = {}
    for line in CLAIMS.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            r = json.loads(line)
        except json.JSONDecodeError:
            continue
        sid = r.get("id")
        if not sid:
            continue
        out[sid] = {
            "id": sid,
            "name": r.get("name", sid),
            "country": r.get("country_code", ""),
            "tier": r.get("tier", ""),
            "source_type": r.get("source_type", "rss"),
            "active": r.get("active", True),
        }
    return out


def load_bias_registry() -> dict[str, dict]:
    """source_id (or root_domain) -> {bloc, country, name, bias axes, ...}"""
    out: dict[str, dict] = {}

    # 1) Deep registry (492 sources) — keyed by id like "reuters"
    if REGISTRY.exists():
        d = json.loads(REGISTRY.read_text())
        for s in d.get("sources", []):
            sid = s.get("id")
            if not sid:
                continue
            geo = (s.get("geo_cluster") or "").lower()
            # Use geo_cluster as primary signal (already curated for T0)
            if geo == "west":
                bloc = "western"
            elif geo == "adversarial":
                bloc = "adversarial"
            else:
                bloc = "non_aligned"
            out[sid] = {
                "name": s.get("name", sid),
                "country": s.get("country", ""),
                "bloc": bloc,
                "bias": s.get("bias", {}),
            }

    # 2) Unified master (27,889 sources) — keyed by root_domain
    if MASTER.exists():
        d = json.loads(MASTER.read_text())
        for s in d:
            dom = s.get("root_domain", "")
            if not dom:
                continue
            # Known-domain ground truth (state-aligned outlets)
            adv_domains = ["rt.com", "tass.com", "sputnik", "presstv", "irna",
                          "xinhua", "cgtn", "chinadaily", "globaltimes", "telesur",
                          "almanar", "almayadeen", "kcna", "ifeng"]
            west_domains = ["reuters.com", "apnews.com", "bbc.co", "cnn.com",
                           "nytimes.com", "washingtonpost.com", "wsj.com",
                           "theguardian.com", "ft.com", "bloomberg.com",
                           "politico.com", "axios.com", "npr.org"]
            is_adv = any(k in dom for k in adv_domains)
            is_west = any(k in dom for k in west_domains)
            w = s.get("bias_western") or 0
            a = s.get("bias_adversarial") or 0
            atl = s.get("bias_atlanticist") or 0
            intv = s.get("bias_interventionist") or 0
            if is_adv:
                bloc = "adversarial"
            elif is_west:
                bloc = "western"
            elif a >= 0.4 and a > (w + atl) / 2:
                bloc = "adversarial"
            elif (w + atl) >= 0.4 or intv >= 0.4:
                bloc = "western"
            else:
                bloc = "non_aligned"
            rec = {
                "name": s.get("name", dom),
                "country": s.get("country_code", ""),
                "bloc": bloc,
                "bias": {
                    "western": w, "adversarial": a, "atlanticist": atl,
                    "interventionist": intv, "statist": s.get("bias_statist") or 0,
                    "financialized": s.get("bias_financialized") or 0,
                },
            }
            # Master keyed by domain — store under both domain and a slug form
            out[dom] = rec
            slug = dom.split(".")[0] if "." in dom else dom
            out.setdefault(slug, rec)
    return out


def extract_entities(article: dict) -> set[str]:
    """Extract proper-noun entities from title + summary."""
    text = f"{article.get('title','')} {article.get('summary','')}"
    out = set()
    for m in PROPER_NOUN_RE.findall(text):
        tokens = m.lower().split()
        if any(t in STOPWORDS for t in tokens):
            continue
        out.add(m.lower())
    return out


def extract_topics(article: dict) -> set[str]:
    text = f"{article.get('title','')} {article.get('summary','')}".lower()
    words = set(WORD_RE.findall(text))
    bigrams = set()
    for i in range(len(text.split()) - 1):
        bigrams.add(" ".join(text.split()[i:i+2]))
    return (words & TOPIC_WORDS) | (bigrams & TOPIC_WORDS)


def cluster_articles(articles: list[dict]) -> list[list[dict]]:
    """Union-find over articles, linking by shared entity OR shared topic+country."""
    parent = list(range(len(articles)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i, j):
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[ri] = rj

    entity_index: dict[str, list[int]] = defaultdict(list)
    topic_country_index: dict[tuple[str, str], list[int]] = defaultdict(list)
    for i, a in enumerate(articles):
        for e in extract_entities(a):
            entity_index[e].append(i)
        sid = a.get("source_id", "")
        for t in extract_topics(a):
            topic_country_index[(t, sid)].append(i)
        # Also link by source (same outlet covering same event often = same story)
        for t in extract_topics(a):
            topic_country_index[(t, "any")].append(i)

    for e, idxs in entity_index.items():
        if len(idxs) < 2 or len(idxs) > 25:
            continue
        for k in idxs[1:]:
            union(idxs[0], k)
    for (t, sid), idxs in topic_country_index.items():
        if len(idxs) < 2 or len(idxs) > 25:
            continue
        for k in idxs[1:]:
            union(idxs[0], k)

    clusters: dict[int, list[int]] = defaultdict(list)
    for i in range(len(articles)):
        clusters[find(i)].append(i)
    return [sorted(idxs) for idxs in clusters.values() if len(idxs) >= 2]


def bloc_label(b: str) -> str:
    """Map "western" → "western"; "non_aligned" stays; etc. Already aligned."""
    return b


def derive_bloc(source_id: str, country: str, registry: dict, claims: dict) -> tuple[str, str]:
    """Return (bloc, country) for a source."""
    if source_id in registry:
        r = registry[source_id]
        return r.get("bloc", "non_aligned"), r.get("country", country)
    if country and country in registry:
        r = registry[country]
        return r.get("bloc", "non_aligned"), r.get("country", country)
    if source_id in claims:
        c = claims[source_id]
        # Heuristic: RU, IR, CN → adversarial; GB, US, FR, DE → western; else non_aligned
        cc = (c.get("country") or "").upper()
        if cc in {"RU", "IR", "CN", "KP", "VE", "CU", "SY"}:
            return "adversarial", cc
        if cc in {"US", "GB", "FR", "DE", "IT", "ES", "CA", "AU", "NZ", "JP", "KR"}:
            return "western", cc
        if cc:
            return "non_aligned", cc
    return "non_aligned", country or ""


def build_story(cluster: list[dict], registry: dict, claims: dict) -> dict:
    """Build a single story dict in the site schema."""
    bloc_spread: Counter = Counter()
    countries: set[str] = set()
    sources: list[dict] = []
    seen_urls: set[str] = set()
    top_titles: list[str] = []
    seen_titles: set[str] = set()

    for art in cluster:
        sid = art.get("source_id", "")
        country = art.get("country", "") or (claims.get(sid, {}).get("country", ""))
        bloc, country = derive_bloc(sid, country, registry, claims)
        if country:
            countries.add(country)
        bloc_spread[bloc_label(bloc)] += 1
        url = art.get("url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            sources.append({
                "name": art.get("source_name", sid) or sid,
                "bloc": bloc,
                "country": country,
                "url": url,
                "excerpt": (art.get("summary", "") or "")[:280],
                "framing_placeholder": None,
            })
        title = art.get("title", "")
        if title and title not in seen_titles:
            seen_titles.add(title)
            top_titles.append(title)

    # Sort top_titles by length-desc (longer = more specific = more representative)
    top_titles.sort(key=lambda t: -len(t))
    top_titles = top_titles[:5]
    primary_urls = [s["url"] for s in sources[:5]]

    # Stable id from sorted urls
    id_seed = "|".join(sorted(seen_urls))
    sid_hash = hex(abs(hash(id_seed)))[2:16]
    return {
        "id": sid_hash,
        "size": len(cluster),
        "assetCount": len(sources),
        "source_count": len(sources),
        "bloc_spread": dict(bloc_spread),
        "bloc_source": "derived",
        "countries": sorted(countries),
        "theaters": sorted(countries),
        "top_headlines": top_titles,
        "topHeadlines": top_titles,
        "primary_urls": primary_urls,
        "sources": sources,
    }


def main():
    articles = load_articles()
    print(f"loaded {len(articles)} articles")
    claims = load_claims()
    print(f"loaded {len(claims)} claims (sources)")
    registry = load_bias_registry()
    print(f"loaded {len(registry)} bias-fingerprinted sources")

    if not articles:
        print("no articles to cluster — exiting")
        return

    clusters = cluster_articles(articles)
    print(f"clustered {len(articles)} articles into {len(clusters)} stories")

    stories = [build_story([articles[i] for i in c], registry, claims) for c in clusters]
    stories.sort(key=lambda s: -s["size"])

    out_obj = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "in_count": len(articles),
        "clustered_count": sum(len(c) for c in clusters),
        "unclustered": len(articles) - sum(len(c) for c in clusters),
        "stories_count": len(stories),
        "stories": stories,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out_obj, indent=2, ensure_ascii=False))
    print(f"wrote {len(stories)} stories -> {OUT}")

    # Schema sanity check
    print()
    print("=== schema sanity ===")
    if stories:
        s = stories[0]
        for k in ["id", "size", "assetCount", "bloc_spread", "countries",
                 "top_headlines", "sources"]:
            v = s.get(k)
            if k == "sources":
                print(f"  {k}: list[{len(v)}] (first source has keys {list(v[0].keys()) if v else 'EMPTY'})")
            else:
                print(f"  {k}: {repr(v)[:80]}")
        print()
        print("first source:", json.dumps(s["sources"][0], indent=2)[:300])
    print()
    print(f"top-level: {list(out_obj.keys())}")


if __name__ == "__main__":
    main()
