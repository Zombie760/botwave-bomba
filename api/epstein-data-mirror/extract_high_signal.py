#!/usr/bin/env python3
"""
Extract the highest-signal slice from the epstein-data.com public mirror.
Output: tight, page-loadable JSON files in api/epstein-data-mirror/.

Signal sources:
- knowledge_graph/entities (524 persons) — the typed actor map
- knowledge_graph/relationships (2,096 typed edges) — traveled_with, paid_by, employed_by, victim_of
- transcripts (1,628 audio/video transcripts) — the deposition / hearing text
- page_classifications (1.4M rows) — what type of document each bates is

Skip the 18MB image_analysis and 3MB+ raw concordance / email / stamps — those
are bulk noise. The user can re-pull the full mirror via refresh.sh.
"""
import json
import csv
from pathlib import Path
from collections import defaultdict

MIRROR = Path('/var/home/gringo/botwave-bomba/api/epstein-data-mirror')
OUT = MIRROR

# 5-dynasty + donor-class + Epstein core + Trump orbit actor whitelist for signal filtering
HIGH_SIGNAL_ENTITIES = {
    # 5 dynasties
    'Jeffrey Epstein', 'Ghislaine Maxwell', 'Donald Trump', 'Joe Biden', 'Barack Obama',
    'Bill Clinton', 'Hillary Clinton', 'George H.W. Bush', 'George W. Bush', 'Prescott Bush',
    'Melania Trump', 'Ivanka Trump', 'Jared Kushner', 'HUNTER BIDEN', 'James Biden',
    'Chelsea Clinton', 'Prince Andrew', 'Alan Dershowitz', 'Kenneth Starr',
    # Wexner / Apollo / Dechert
    'Les Wexner', 'Leslie Wexner', 'Leon Black', 'Marc Rowan', 'Josh Harris',
    'Glenn Dubin', 'Daniel Zwirn', 'Stephen Black', 'Michael Krumholz',
    # Banks
    'JPMorgan', 'Jamie Dimon', 'Deutsche Bank', 'Bank of America',
    'Bear Stearns', 'Lloyds',
    # Trump orbit 2024-2026
    'Elon Musk', 'David Sacks', 'Stephen Miller', 'JD Vance', 'Pete Hegseth',
    'Robert F. Kennedy Jr.', 'Tulsi Gabbard', 'Kash Patel', 'Pam Bondi',
    'Peter Thiel', 'David Sachs',
    # Donor class (the 10)
    'Michael Bloomberg', 'George Soros', 'Tom Steyer', 'Haim Saban',
    'Sheldon Adelson', 'Charles Koch', 'David Koch', 'Steven Mnuchin',
    # Media / fixers
    'Rupert Murdoch', 'Jeff Bezos', 'Mark Zuckerberg',
    # Carlyle / defense
    'Frank Carlucci', 'James Baker', 'Rudy Giuliani',
    # Intel / legal
    'Robert Mueller', 'James Comey', 'William Barr', 'Merrick Garland',
    'David Weiss', 'Lawrence Summers', 'Larry Summers',
    # Other named
    'Ehud Barak', 'Mortimer Zuckerman', 'Reid Weingarten',
    'Jean-Luc Brunel', 'Sarah Kellen', 'Nadia Marcinkova',
    'Emmy Tayler', 'Courtney Wild', 'Virginia Giuffre',
    'Bill Richardson', 'George Mitchell', 'Lawrence Krauss',
    'Marvin Minsky', 'Stephen Hawking', 'Noam Chomsky', 'Eva Dubin',
}


def extract_kg_entities():
    with open(MIRROR / 'kg_entities.json') as f:
        entities = json.load(f)

    # All entities are signal — but only 600 of them. Keep all.
    # Also filter for high-signal: if name is in whitelist OR person_type in (perpetrator, victim)
    out = []
    for e in entities:
        name = e.get('name', '')
        meta_raw = e.get('metadata') or '{}'
        try:
            meta = json.loads(meta_raw) if isinstance(meta_raw, str) else meta_raw
        except Exception:
            meta = {}
        is_high = (
            name in HIGH_SIGNAL_ENTITIES
            or meta.get('person_type') in ('perpetrator', 'victim', 'associate', 'witness')
            or meta.get('public_figure') is True
            or meta.get('ds10_mention_count', 0) >= 10
        )
        if is_high:
            out.append({
                'id': e['id'],
                'name': name,
                'entity_type': e.get('entity_type'),
                'person_type': meta.get('person_type'),
                'occupation': meta.get('occupation'),
                'public_figure': meta.get('public_figure'),
                'legal_status': meta.get('legal_status'),
                'ds10_mention_count': meta.get('ds10_mention_count', 0),
            })
    out.sort(key=lambda x: -x['ds10_mention_count'])
    return out


def extract_kg_relationships(entity_ids: set):
    with open(MIRROR / 'kg_relationships.json') as f:
        rels = json.load(f)
    out = []
    for r in rels:
        if r.get('source_entity_id') in entity_ids and r.get('target_entity_id') in entity_ids:
            meta_raw = r.get('metadata') or '{}'
            try:
                meta = json.loads(meta_raw) if isinstance(meta_raw, str) else meta_raw
            except Exception:
                meta = {}
            out.append({
                'id': r['id'],
                'source': r['source_entity_id'],
                'target': r['target_entity_id'],
                'type': r['relationship_type'],
                'weight': r.get('weight', 0),
                'date_first': r.get('date_first'),
                'date_last': r.get('date_last'),
                'notes': meta,
            })
    out.sort(key=lambda x: -x['weight'])
    return out


def extract_transcripts():
    with open(MIRROR / 'transcripts.json') as f:
        transcripts = json.load(f)
    out = []
    for t in transcripts:
        # Strip huge text fields — keep summary only
        if isinstance(t, dict):
            row = {k: v for k, v in t.items() if k != 'text' and k != 'transcript_text' and k != 'content'}
            text = t.get('text') or t.get('transcript_text') or t.get('content') or ''
            row['text_preview'] = text[:500] if text else ''
            row['text_length'] = len(text) if text else 0
            out.append(row)
    return out


def extract_page_classifications():
    with open(MIRROR / 'page_classifications.json') as f:
        classifications = json.load(f)
    # Group by doc_type, return counts + high-signal subset
    from collections import Counter
    type_counts = Counter(c.get('doc_type') for c in classifications)
    # Highest-signal document types
    HIGH_VALUE_TYPES = {
        'court.indictment', 'court.filing', 'court.order', 'court.exhibit_list',
        'court.plea_agreement', 'transcript.deposition', 'transcript.hearing',
        'financial.wire_transfer', 'financial.bank_statement', 'phone.log',
        'email', 'letter', 'memo',
    }
    high_signal = [c for c in classifications if c.get('doc_type') in HIGH_VALUE_TYPES]
    high_signal.sort(key=lambda x: -x.get('page_count', 0))
    return {
        'total_in_sample': len(classifications),
        'sample_doc_types': dict(type_counts.most_common(30)),
        'high_signal_docs': high_signal[:200],  # top 200 by page count
    }


def main():
    print("Extracting highest-signal slices from public mirror...")

    # 1. Knowledge graph entities
    entities = extract_kg_entities()
    print(f"  kg_entities: {len(entities)} high-signal of 600 total")
    with open(OUT / 'kg_entities_signal.json', 'w') as f:
        json.dump(entities, f, ensure_ascii=False, separators=(',', ':'))

    # 2. Knowledge graph relationships (only between high-signal entities)
    entity_ids = {e['id'] for e in entities}
    rels = extract_kg_relationships(entity_ids)
    print(f"  kg_relationships (signal): {len(rels)} typed edges")
    with open(OUT / 'kg_relationships_signal.json', 'w') as f:
        json.dump(rels, f, ensure_ascii=False, separators=(',', ':'))

    # 3. Transcripts
    transcripts = extract_transcripts()
    print(f"  transcripts: {len(transcripts)} (with 500-char previews)")
    with open(OUT / 'transcripts_signal.json', 'w') as f:
        json.dump(transcripts, f, ensure_ascii=False, separators=(',', ':'))

    # 4. Page classifications (counts + top high-signal docs)
    classifications = extract_page_classifications()
    print(f"  page_classifications: {classifications['total_in_sample']} sampled, {len(classifications['high_signal_docs'])} high-signal")
    with open(OUT / 'page_classifications_signal.json', 'w') as f:
        json.dump(classifications, f, ensure_ascii=False, separators=(',', ':'))

    # 5. Combined: a single high-signal file the page can load in one fetch
    combined = {
        'extracted_at': '2026-07-14',
        'source': 'https://epstein-data.com',
        'signal_count': {
            'entities': len(entities),
            'relationships': len(rels),
            'transcripts': len(transcripts),
            'classifications_sample': classifications['total_in_sample'],
            'high_value_docs': len(classifications['high_signal_docs']),
        },
        'entities': entities[:100],  # top 100 by mention count
        'top_relationships': rels[:100],  # top 100 by weight
        'transcript_previews': transcripts[:50],
        'doc_type_distribution': classifications['sample_doc_types'],
        'high_value_docs': classifications['high_signal_docs'][:50],
    }
    with open(OUT / 'high-signal.json', 'w') as f:
        json.dump(combined, f, ensure_ascii=False, separators=(',', ':'))

    # Size summary
    print()
    for f in sorted(OUT.glob('*.json')):
        size_kb = f.stat().st_size / 1024
        print(f"  {f.name}: {size_kb:.1f} KB")
    print("\nDONE. Full mirror available via refresh.sh; only the high-signal slices are committed.")


if __name__ == '__main__':
    main()
