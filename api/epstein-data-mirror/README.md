# Public Research Mirror — epstein-data.com

This directory is the highest-signal extraction from the public forensic
database at **https://epstein-data.com**, released under the **Epstein
Files Transparency Act (Public Law 119-38)**. The site is a Datasette
mirror of the DOJ production, with FTS5 full-text search across 2,770,154
pages, a 524-entity knowledge graph, 2,096 typed relationships, 92K
AI-described images, 1,628 audio/video transcripts, and 2.6M redaction
locations. Public. Free. No API key. AI-input=yes per the operator's
robots.txt. Sanctioned for journalism research.

## What this directory contains

| File | Size | What it is |
|------|------|------------|
| `high-signal.json` | 84 KB | One-fetch bundle: top 100 actors + top 100 relationships + 50 transcript previews + doc type distribution + 50 high-value documents. The page loads this. |
| `kg_entities_signal.json` | 18 KB | 108 entities filtered from 600: perpetrators, victims, public figures, ≥10 ds10 mentions. The actor map. |
| `kg_relationships_signal.json` | 50 KB | 195 typed edges between signal entities: `traveled_with`, `paid_by`, `employed_by`, `victim_of`, `owned_by`, `represented_by`, `associated_with`, `communicated_with`. With weights (shared flight counts, payment amounts) and date ranges. |
| `transcripts_signal.json` | 1.8 MB | 1,628 audio/video transcripts with 500-char previews and total length. The deposition / hearing text. |
| `page_classifications_signal.json` | 84 KB | Document type distribution + 200 highest-value documents (court filings, depositions, financial, emails) ranked by page count. |
| `refresh.sh` | 2.3 KB | Re-pull the full mirror in ~12 seconds. No key required. |

## What was filtered out, and why

The full mirror has 32 MB. We committed 2 MB. This is the same move a
journal makes when it publishes the methods section and the figures, not
the entire raw data tape. The raw data is one command away. The signal
is what's loadable in a browser tab.

| Filtered out | Size | Why |
|--------------|------|-----|
| `image_analysis.json` | 18 MB | Image metadata + AI descriptions. The images themselves are on epstein-data.com. We don't re-host the imagery. |
| `concordance_documents.json` | 3.2 MB | Bulk document index. The high-value docs are in `page_classifications_signal.json`. The full concordance is re-pullable. |
| `email_metadata.json` | 2.3 MB | ~500K raw email headers. The high-signal emails (matching ds10 entities) are surfaced via the relationships. |
| `secondary_stamps.json` | 2.3 MB | Cross-reference numbers (R1, JPM-SDNY, etc.). Useful for cross-referencing, not for the page itself. |
| `redaction_locations.json` | 1.9 MB | 2.6M redaction coordinates. The 107K named entities are in the knowledge graph. |

## The principle

We do the work of filtering so the working class doesn't have to. The DOJ
released 1.4 million documents. Most people will never read them. Most
people don't have the time, the legal training, or the institutional
support to find the mechanism buried in the deposition transcripts and
the wire transfer records. We read them. We extract the signal. We show
the mechanism. We teach the method. We do not gatekeep. We do not
fabricate. The substrate is filed. The receipts are cited. The methods
are reproducible.

The Live OSINT page is the methods section. It is a scientific journal
for the 1-party donor class. Every claim has a bates number. Every
audit can be re-run. The refresh script is the raw data. The high-signal
slices are the figures.

## Reproducing this

```bash
# 1. Re-pull the full mirror
cd api/epstein-data-mirror
bash refresh.sh

# 2. Extract the high-signal slices
python3 extract_high_signal.py

# 3. Build the page
cd ../../
bun scripts/build_site.ts
git add -A && git commit -m "Refresh high-signal mirror" && git push origin main
```

The full mirror is 1,416,831 documents. The high-signal slices are
108 actors, 195 typed relationships, 200 high-value documents, and
1,628 transcript previews. The ratio is 0.0001%. That is the
signal-to-noise floor. We publish the numerator, not the denominator.
The denominator is one command away for anyone who wants it.

## License

The source data is public record under Public Law 119-38. The mirror
JSON files in this directory are derivative works for journalism and
research. Use freely. Cite the bates number.
