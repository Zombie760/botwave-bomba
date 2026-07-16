#!/usr/bin/env python3
"""
scrape_related_outlets.py — BotwaveBomba Phase 1: Scrape related outlets for a given story.

Usage:
    python3 scripts/scrape_related_outlets.py --url "https://www.theguardian.com/us-news/2026/jul/12/ro-khanna-israel-detention-reaction" --max 50

Output:
    related_outlets.jsonl — {url, title, source_domain, political_bias, bloc, funders}
"""

import argparse
import json
import re
import time
from pathlib import Path
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

# Repo paths
REPO = Path(__file__).resolve().parents[1]
SOURCES_JSON = REPO / "_data" / "sources.json"
OUTPUT_JSONL = REPO / "data" / "related_outlets.jsonl"

# Load sources.json for bias/bloc/funders lookup
with open(SOURCES_JSON) as f:
    SOURCES = json.load(f)

# Residential proxy via Tailscale (zombie device)
TAILSCALE_PROXY = "socks5://localhost:9090"

# User-Agent for stealth
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36"
)

# Domains to skip (ad networks, CDNs, etc.)
SKIP_DOMAINS = {
    "doubleclick.net", "googlesyndication.com", "facebook.com", "twitter.com",
    "instagram.com", "youtube.com", "cdn.ampproject.org", "outbrain.com",
    "taboola.com", "scorecardresearch.com", "chartbeat.com", "quantserve.com",
}


def get_bias_bloc_funders(domain: str) -> dict:
    """Lookup source metadata by domain."""
    domain = domain.lower().strip()
    for src_domain, src_data in SOURCES.items():
        if domain.endswith(src_domain) or src_domain.endswith(domain):
            return {
                "political_bias": src_data.get("political_bias", "unknown"),
                "bloc": src_data.get("bloc", "unknown"),
                "funders": src_data.get("funders", []),
                "ownership": src_data.get("ownership", "unknown"),
            }
    return {
        "political_bias": "unknown",
        "bloc": "unknown",
        "funders": [],
        "ownership": "unknown",
    }


def extract_links(url: str, max_links: int = 50) -> list[str]:
    """Scrape a page and extract unique links to other news outlets."""
    try:
        with httpx.Client(proxy=TAILSCALE_PROXY, timeout=30.0) as client:
            r = client.get(url, headers={"User-Agent": USER_AGENT})
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            
            # Remove script/style/iframe
            for tag in soup(["script", "style", "iframe", "noscript"]):
                tag.decompose()
            
            # Extract all links
            links = set()
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if not href or href.startswith(('javascript:', 'mailto:', 'tel:')):
                    continue
                parsed = urlparse(href)
                if not parsed.netloc or parsed.netloc in SKIP_DOMAINS:
                    continue
                # Normalize domain
                domain = parsed.netloc.lower()
                if domain.startswith("www."):
                    domain = domain[4:]
                # Skip self-links
                if domain in urlparse(url).netloc.lower():
                    continue
                links.add(f"https://{domain}")
                if len(links) >= max_links:
                    break
            return list(links)
    except Exception as e:
        print(f"[ERROR] extract_links({url}): {e}")
        return []


def scrape_outlet_metadata(outlet_url: str) -> dict:
    """Scrape outlet homepage for title and metadata."""
    try:
        with httpx.Client(proxy=TAILSCALE_PROXY, timeout=30.0) as client:
            r = client.get(outlet_url, headers={"User-Agent": USER_AGENT})
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            
            # Extract title
            title = soup.title.string if soup.title and soup.title.string else "Untitled"
            title = re.sub(r"\s+\|.*$", "", title).strip()
            
            # Extract domain
            domain = urlparse(outlet_url).netloc.lower()
            if domain.startswith("www."):
                domain = domain[4:]
            
            # Lookup bias/bloc/funders
            metadata = get_bias_bloc_funders(domain)
            
            return {
                "url": outlet_url,
                "title": title,
                "source_domain": domain,
                **metadata,
            }
    except Exception as e:
        print(f"[ERROR] scrape_outlet_metadata({outlet_url}): {e}")
        return {
            "url": outlet_url,
            "title": "Untitled",
            "source_domain": urlparse(outlet_url).netloc.lower(),
            "political_bias": "unknown",
            "bloc": "unknown",
            "funders": [],
            "ownership": "unknown",
        }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True, help="URL of the seed story")
    ap.add_argument("--max", type=int, default=50, help="Max outlets to scrape")
    args = ap.parse_args()
    
    print(f"[scrape_related_outlets] seed: {args.url}")
    links = extract_links(args.url, max_links=args.max)
    print(f"[scrape_related_outlets] found {len(links)} unique outlets")
    
    results = []
    for i, link in enumerate(links, 1):
        print(f"[scrape_related_outlets] scraping {i}/{len(links)}: {link}")
        result = scrape_outlet_metadata(link)
        results.append(result)
        time.sleep(1.0)  # Be polite
    
    # Write to JSONL
    with open(OUTPUT_JSONL, "w") as f:
        for result in results:
            f.write(json.dumps(result) + "\n")
    print(f"[scrape_related_outlets] wrote {len(results)} records to {OUTPUT_JSONL}")


if __name__ == "__main__":
    main()