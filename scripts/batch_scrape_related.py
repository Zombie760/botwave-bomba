#!/usr/bin/env python3
"""
batch_scrape_related.py — BotwaveBomba Phase 1: Batch scrape related outlets for multiple stories.

Usage:
    python3 scripts/batch_scrape_related.py --stories stories.txt --workers 10

Input:
    stories.txt — one story URL per line

Output:
    data/related_outlets_{timestamp}.jsonl — {url, title, source_domain, political_bias, bloc, funders}
"""

import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

# Repo paths
REPO = Path(__file__).resolve().parents[1]
SOURCES_JSON = REPO / "_data" / "sources.json"
OUTPUT_DIR = REPO / "data"

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
            title = re.sub(r"\s+\|.*$", "", title).strip() if title else "Untitled"
            
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


def process_story(story_url: str, max_outlets: int = 50) -> list[dict]:
    """Process one story URL and return related outlets."""
    print(f"[batch_scrape_related] processing: {story_url}")
    links = extract_links(story_url, max_links=max_outlets)
    results = []
    for i, link in enumerate(links, 1):
        print(f"[batch_scrape_related] scraping {i}/{len(links)}: {link}")
        result = scrape_outlet_metadata(link)
        results.append(result)
        time.sleep(0.5)  # Be polite
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stories", required=True, help="File with one story URL per line")
    ap.add_argument("--workers", type=int, default=5, help="Max parallel workers")
    ap.add_argument("--max", type=int, default=50, help="Max outlets per story")
    args = ap.parse_args()
    
    OUTPUT_DIR.mkdir(exist_ok=True)
    timestamp = int(time.time())
    output_path = OUTPUT_DIR / f"related_outlets_{timestamp}.jsonl"
    
    with open(args.stories) as f:
        story_urls = [line.strip() for line in f if line.strip()]
    
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(process_story, url, args.max): url
            for url in story_urls
        }
        with open(output_path, "w") as f:
            for future in as_completed(futures):
                results = future.result()
                for result in results:
                    f.write(json.dumps(result) + "\n")
    
    print(f"[batch_scrape_related] wrote {output_path}")


if __name__ == "__main__":
    import re
    main()