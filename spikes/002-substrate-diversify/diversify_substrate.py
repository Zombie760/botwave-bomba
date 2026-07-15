"""
Spike 002: substrate-diversify

Pull a balanced sample from sources_master.json (27,889 sources) into a
diversified claims.jsonl for the Bomba scout pipeline.

Goal: reflect the actual global press landscape, not a Western-dominated
list. Bomba's moat is the non-Western view.

Per bloc targets (loose, based on real global press distribution):
  western:     200  (Atlanticist, interventionist, US/EU aligned)
  adversarial: 100  (RT, TASS, IRNA, Xinhua, CGTN, PressTV, Telesur, etc.)
  non_aligned: 600  (Global South, regional press — the majority)

The output is a claims.jsonl the scout's ingest_pipeline.py can consume.

Input:
  /var/home/gringo/Botwave-Master-Consolidated/ARMS/business/Business/ContentEngine/news_crawler/sources_master.json
  /var/home/gringo/Botwave-Master/Telos/substrate/bomba_sources/claims.jsonl (existing — for dedup)

Output:
  /var/home/gringo/Botwave-Master/Telos/substrate/bomba_sources/claims.jsonl (appended)
  /var/home/gringo/botwave-bomba/spikes/002-substrate-diversify/diversification_report.json

Spike 002 / 2026-07-15 / Botwave Bomba / NISA
"""
from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

MASTER = Path("/var/home/gringo/Botwave-Master-Consolidated/ARMS/business/Business/ContentEngine/news_crawler/sources_master.json")
CLAIMS = Path("/var/home/gringo/Botwave-Master/Telos/substrate/bomba_sources/claims.jsonl")
REPORT = Path("/var/home/gringo/botwave-bomba/spikes/002-substrate-diversify/diversification_report.json")

# Hardcoded known-adversarial domains — these are state-aligned outlets
# (Russia, Iran, China, Venezuela). Use as ground truth when bias axis is missing.
KNOWN_ADVERSARIAL = {
    # Russia
    "rt.com", "tass.com", "sputniknews.com", "sputnik.com", "sputnik", "ria.ru",
    "pravda.ru", "lenta.ru", "gazeta.ru", "kp.ru", "rbc.ru", "vedomosti.ru",
    # Iran
    "presstv.com", "presstv.ir", "irna.ir", "mehrnews.com", "tasnimnews.com",
    "farsnews", "ifpnews.com", "en.irna",
    # China
    "xinhua", "xinhuanet.com", "cgtn.com", "chinadaily.com.cn", "globaltimes",
    "globaltimes.cn", "cn.chinadaily.com.cn", "ecns.cn", "people.com.cn",
    # Venezuela
    "telesurtv.net", "telesurenglish.net",
    # Other state-aligned
    "almanar.com", "english.almayadeen.net", "almayadeen.net",
    "pchrtv.com",
    "ifeng.com", "huxiu.com",
    "koryo-group", "kcna.kp", "kcna",  # DPRK
}

# Hardcoded known-Western anchors — the major Western wire services + mastheads
KNOWN_WESTERN = {
    "reuters.com", "apnews.com", "ap.org", "bbc.com", "bbc.co.uk",
    "cnn.com", "nytimes.com", "washingtonpost.com", "wsj.com",
    "theguardian.com", "ft.com", "bloomberg.com", "politico.com",
    "axios.com", "npr.org", "cbsnews.com", "nbcnews.com", "foxnews.com",
    "usatoday.com", "latimes.com", "chicagotribune.com", "bostonglobe.com",
    "economist.com", "time.com", "newsweek.com", "vice.com", "vox.com",
    "theatlantic.com", "newyorker.com", "huffpost.com", "buzzfeed.com",
    "dailymail.co.uk", "telegraph.co.uk", "independent.co.uk",
    "lemonde.fr", "lefigaro.fr", "spiegel.de", "faz.net", "welt.de",
    "elpais.es", "elmundo.es", "ansa.it", "repubblica.it",
    "asahi.com", "yomiuri.co.jp", "japantimes.co.jp", "koreaherald.com",
}

# Western-aligned country codes (Atlanticist)
WESTERN_COUNTRIES = {
    "US", "GB", "FR", "DE", "IT", "ES", "CA", "AU", "NZ", "JP", "KR",
    "NL", "BE", "CH", "AT", "SE", "NO", "DK", "FI", "IE", "PT", "GR",
    "IL",  # Israel — Atlanticist / aligned
    "PL", "CZ", "SK", "HU",  # EU NATO members
    "TW",  # contested but Western-aligned press
}

# Adversarial-aligned country codes (state press)
ADVERSARIAL_COUNTRIES = {
    "RU", "IR", "CN", "KP", "VE", "CU", "SY", "MM", "BY",
    "UZ", "TM", "TJ",  # Central Asian autocracies
    "ER", "SS",  # pariah states
}


def bloc(s: dict) -> str:
    """Decide bloc using: known-domain lists (ground truth) > country > bias axis."""
    dom = (s.get("root_domain") or "").lower()

    # 1) Known-domain ground truth (highest priority)
    for k in KNOWN_ADVERSARIAL:
        if k in dom:
            return "adversarial"
    for k in KNOWN_WESTERN:
        if k in dom:
            return "western"

    # 2) Country code
    cc = (s.get("country_code") or "").upper()
    if cc in ADVERSARIAL_COUNTRIES:
        return "adversarial"
    if cc in WESTERN_COUNTRIES:
        return "western"

    # 3) Bias axis (last resort)
    w = s.get("bias_western") or 0
    a = s.get("bias_adversarial") or 0
    atl = s.get("bias_atlanticist") or 0
    intv = s.get("bias_interventionist") or 0
    if a >= 0.4 and a > (w + atl) / 2:
        return "adversarial"
    if (w + atl) >= 0.4 or intv >= 0.4:
        return "western"
    return "non_aligned"


def to_claim(s: dict) -> dict:
    """Convert a master record to a claim.jsonl line."""
    cc = s.get("country_code") or ""
    # Normalize country code to ISO 3166 alpha-2 when possible
    cc_norm = cc[:2].upper() if cc and cc not in {"", "?", "nan"} else ""
    return {
        "id": s.get("root_domain", "").replace(".", "_").replace("/", "_"),
        "ts": datetime.now(timezone.utc).isoformat(),
        "type": "bomba_news_source",
        "name": s.get("name") or s.get("root_domain", ""),
        "url": s.get("target_url") or f"https://{s.get('root_domain','')}",
        "source_type": "rss" if s.get("feed_url") else "sitemap",
        "country": cc_norm or cc[:8],
        "language": (s.get("language") or "en")[:8],
        "tier": s.get("tier"),
        "active": True,
        "feed_url": s.get("feed_url"),
        "bias_western": s.get("bias_western") or 0,
        "bias_adversarial": s.get("bias_adversarial") or 0,
        "bias_atlanticist": s.get("bias_atlanticist") or 0,
        "bias_interventionist": s.get("bias_interventionist") or 0,
        "bias_statist": s.get("bias_statist") or 0,
        "bias_financialized": s.get("bias_financialized") or 0,
        "mbfc_credibility": s.get("mbfc_credibility") or "medium",
        "root_domain": s.get("root_domain"),
    }


def main():
    master = json.loads(MASTER.read_text())
    print(f"master: {len(master):,} sources")

    # Classify all
    by_bloc = {"western": [], "adversarial": [], "non_aligned": []}
    no_dom = 0
    for s in master:
        rd = s.get("root_domain")
        if not rd:
            no_dom += 1
            continue
        b = bloc(s)
        by_bloc[b].append(s)

    print(f"by bloc (master):")
    for b, lst in by_bloc.items():
        print(f"  {b}: {len(lst):,}")
    print(f"  no domain: {no_dom:,}")

    # Load existing claims for dedup
    existing_ids = set()
    if CLAIMS.exists():
        for line in CLAIMS.read_text().splitlines():
            try:
                r = json.loads(line)
                if r.get("id"):
                    existing_ids.add(r["id"])
            except json.JSONDecodeError:
                continue
    print(f"existing claims: {len(existing_ids)}")

    # Diversify: pick a balanced sample
    TARGETS = {"western": 250, "adversarial": 120, "non_aligned": 700}

    # Prefer records WITH feed_url (RSS-fetchable) then country, then rest
    def priority(s):
        score = 0
        if s.get("feed_url"): score += 100
        if s.get("country_code"): score += 10
        if s.get("language"): score += 1
        return -score  # sort ascending = highest priority first

    new_claims = []
    sampled_ids = set()
    for bloc_name, target in TARGETS.items():
        pool = by_bloc[bloc_name]
        pool_sorted = sorted(pool, key=priority)
        added = 0
        for s in pool_sorted:
            cid = s.get("root_domain", "").replace(".", "_").replace("/", "_")
            if cid in existing_ids or cid in sampled_ids:
                continue
            if added >= target:
                break
            new_claims.append(to_claim(s))
            sampled_ids.add(cid)
            added += 1
        print(f"  sampled {added}/{target} {bloc_name}")

    # Write to claims.jsonl (append, then compact later)
    with CLAIMS.open("a", encoding="utf-8") as f:
        for c in new_claims:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
    print(f"appended {len(new_claims)} new claims to {CLAIMS}")

    # Report
    by_country = Counter(c["country"] for c in new_claims if c["country"])
    by_lang = Counter(c["language"] for c in new_claims if c["language"])
    by_tier = Counter(c.get("tier","?") for c in new_claims)
    by_bloc_added = Counter(bloc({"root_domain": c["root_domain"], "country_code": c["country"]}) for c in new_claims)
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "master_total": len(master),
        "existing_claims": len(existing_ids),
        "added": len(new_claims),
        "by_bloc_added": dict(by_bloc_added),
        "by_country_top20": by_country.most_common(20),
        "by_lang_top10": by_lang.most_common(10),
        "by_tier": dict(by_tier),
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"report -> {REPORT}")
    print()
    print("=== by_bloc_added ===")
    for b, n in by_bloc_added.most_common():
        print(f"  {b}: {n}")
    print()
    print("=== by_country_top20 ===")
    for c, n in by_country.most_common(20):
        print(f"  {c}: {n}")


if __name__ == "__main__":
    main()
