#!/usr/bin/env python3
"""
Fetch and process 1,000+ real news sources for Botwave Bomba.
"""

import json
import requests
from bs4 import BeautifulSoup

# Configuration
OUTPUT_FILE = "/var/home/gringo/botwave-bomba/api/sources.json"

# Media Bias/Fact Check dataset (example URL)
MBFC_URL = "https://mediabiasfactcheck.com/sources/"

# AllSides dataset (example URL)
ALLSIDES_URL = "https://www.allsides.com/media-bias/media-bias-ratings"

# Wikipedia list of news sources (example URL)
WIKIPEDIA_URL = "https://en.wikipedia.org/wiki/List_of_news_media"


def fetch_mbfc_sources():
    """Fetch sources from Media Bias/Fact Check."""
    try:
        response = requests.get(MBFC_URL)
        soup = BeautifulSoup(response.text, 'html.parser')
        sources = []
        
        # Example: Extract source names and bias ratings
        for row in soup.select('table tr'):
            cells = row.find_all('td')
            if len(cells) >= 2:
                name = cells[0].text.strip()
                bias = cells[1].text.strip().lower()
                
                # Map bias to Botwave Bomba format
                if "left" in bias:
                    bias = "left"
                elif "lean left" in bias:
                    bias = "lean-left"
                elif "center" in bias:
                    bias = "center"
                elif "lean right" in bias:
                    bias = "lean-right"
                elif "right" in bias:
                    bias = "right"
                else:
                    bias = "center"
                
                # Default metadata
                sources.append({
                    "name": name,
                    "domain": f"{name.lower().replace(' ', '')}.com",
                    "bloc": "western",  # Default, adjust as needed
                    "bias": bias,
                    "factfulness": "high",  # Default, adjust as needed
                    "tone": "neutral"  # Default, adjust as needed
                })
        
        return sources
    except Exception as e:
        print(f"Error fetching MBFC sources: {e}")
        return []


def fetch_allsides_sources():
    """Fetch sources from AllSides."""
    try:
        response = requests.get(ALLSIDES_URL)
        soup = BeautifulSoup(response.text, 'html.parser')
        sources = []
        
        # Example: Extract source names and bias ratings
        for row in soup.select('table tr'):
            cells = row.find_all('td')
            if len(cells) >= 2:
                name = cells[0].text.strip()
                bias = cells[1].text.strip().lower()
                
                # Map bias to Botwave Bomba format
                if "left" in bias:
                    bias = "left"
                elif "lean left" in bias:
                    bias = "lean-left"
                elif "center" in bias:
                    bias = "center"
                elif "lean right" in bias:
                    bias = "lean-right"
                elif "right" in bias:
                    bias = "right"
                else:
                    bias = "center"
                
                # Default metadata
                sources.append({
                    "name": name,
                    "domain": f"{name.lower().replace(' ', '')}.com",
                    "bloc": "western",  # Default, adjust as needed
                    "bias": bias,
                    "factfulness": "high",  # Default, adjust as needed
                    "tone": "neutral"  # Default, adjust as needed
                })
        
        return sources
    except Exception as e:
        print(f"Error fetching AllSides sources: {e}")
        return []


def fetch_wikipedia_sources():
    """Fetch sources from Wikipedia."""
    try:
        response = requests.get(WIKIPEDIA_URL)
        soup = BeautifulSoup(response.text, 'html.parser')
        sources = []
        
        # Example: Extract source names
        for row in soup.select('table tr'):
            cells = row.find_all('td')
            if len(cells) >= 1:
                name = cells[0].text.strip()
                
                # Default metadata
                sources.append({
                    "name": name,
                    "domain": f"{name.lower().replace(' ', '')}.com",
                    "bloc": "western",  # Default, adjust as needed
                    "bias": "center",  # Default, adjust as needed
                    "factfulness": "high",  # Default, adjust as needed
                    "tone": "neutral"  # Default, adjust as needed
                })
        
        return sources
    except Exception as e:
        print(f"Error fetching Wikipedia sources: {e}")
        return []


def save_sources(sources):
    """Save sources to sources.json."""
    with open(OUTPUT_FILE, "w") as f:
        json.dump(sources, f, indent=2)
    
    print(f"Saved {len(sources)} sources to {OUTPUT_FILE}")


def main():
    print("Fetching real sources...")
    
    # Fetch sources from multiple datasets
    mbfc_sources = fetch_mbfc_sources()
    allsides_sources = fetch_allsides_sources()
    wikipedia_sources = fetch_wikipedia_sources()
    
    # Combine and deduplicate sources
    all_sources = mbfc_sources + allsides_sources + wikipedia_sources
    unique_sources = {source["domain"]: source for source in all_sources}.values()
    
    # Save to file
    save_sources(list(unique_sources))
    
    print("Source fetch complete.")


if __name__ == "__main__":
    main()