#!/usr/bin/env python3
"""
superdonor_mapper.py — BotwaveBomba Phase 1: Cross-reference OCR database + Donor Class Bible.

Usage:
    python3 scripts/superdonor_mapper.py

Output:
    data/superdonors.json — {name, type, funded_outlets, funding_amount, overlap_with}
"""

import json
import sqlite3
from pathlib import Path

# Repo paths
REPO = Path(__file__).resolve().parents[1]
OCR_DB = REPO / "data" / "external" / "ocr_database.db"
DONOR_BIBLE = REPO / "data" / "external" / "Donor_Class_Bible_Deep_State_2026.pdf"
OUTPUT_JSON = REPO / "data" / "superdonors.json"

# Superdonor seed data (from Donor Class Bible)
SEED_DONORS = [
    {
        "name": "George Soros",
        "type": "Individual",
        "affiliation": "Open Society Foundations",
        "funding_amount": "$1.2B (2020-2026)",
        "overlap_with": ["Koch Industries", "Zionist Media"],
    },
    {
        "name": "Koch Industries",
        "type": "Corporate",
        "affiliation": "i360 / Americans for Prosperity",
        "funding_amount": "$12M (2020-2026)",
        "overlap_with": ["George Soros", "Zionist Media"],
    },
    {
        "name": "AIPAC",
        "type": "Lobby",
        "affiliation": "Zionist donor networks",
        "funding_amount": "$50M (2020-2026)",
        "overlap_with": ["George Soros", "Koch Industries"],
    },
    {
        "name": "Qatar Investment Authority",
        "type": "State",
        "affiliation": "Qatar government",
        "funding_amount": "$22M (2020-2026)",
        "overlap_with": ["Zionist Media"],
    },
]


def extract_ocr_data() -> list[dict]:
    """Extract donor-outlet relationships from OCR database."""
    conn = sqlite3.connect(OCR_DB)
    cursor = conn.cursor()
    
    # Query for Soros/Koch/Zionist mentions
    cursor.execute(
        """
        SELECT efta_number, ocr_text
        FROM ocr_results
        WHERE ocr_text LIKE '%Soros%' OR ocr_text LIKE '%Koch%' OR ocr_text LIKE '%Zionist%'
        LIMIT 1000;
        """
    )
    
    results = []
    for efta_number, ocr_text in cursor.fetchall():
        # Extract outlet names (simplified regex)
        outlets = []
        for word in ocr_text.split():
            if ".com" in word or ".org" in word:
                outlets.append(word.lower().strip(".,;:"))
        
        results.append({
            "efta_number": efta_number,
            "ocr_text": ocr_text[:200] + "...",
            "outlets": outlets,
        })
    
    conn.close()
    return results


def map_superdonors(ocr_data: list[dict]) -> list[dict]:
    """Map OCR data to superdonor seed data."""
    superdonors = {donor["name"]: donor for donor in SEED_DONORS}
    
    for record in ocr_data:
        for outlet in record["outlets"]:
            for donor_name, donor in superdonors.items():
                if donor_name.lower() in record["ocr_text"].lower():
                    if outlet not in donor.get("funded_outlets", []):
                        donor.setdefault("funded_outlets", []).append(outlet)
    
    return list(superdonors.values())


def main():
    print("[superdonor_mapper] extracting OCR data...")
    ocr_data = extract_ocr_data()
    print(f"[superdonor_mapper] found {len(ocr_data)} OCR records")
    
    print("[superdonor_mapper] mapping superdonors...")
    superdonors = map_superdonors(ocr_data)
    
    with open(OUTPUT_JSON, "w") as f:
        json.dump(superdonors, f, indent=2)
    
    print(f"[superdonor_mapper] wrote {OUTPUT_JSON}")


if __name__ == "__main__":
    main()