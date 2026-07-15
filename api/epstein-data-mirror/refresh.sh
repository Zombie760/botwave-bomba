#!/usr/bin/env bash
# refresh.sh — re-pull the public research mirror from epstein-data.com
# Run anytime. ~12 seconds on a fast connection. No API key required.
# Source: https://epstein-data.com (Public Law 119-38, ai-input=yes, journalism research)
#
# The mirror contains:
#   - knowledge_graph/entities       524 persons (typed: perpetrator/victim/associate/witness)
#   - knowledge_graph/relationships  2,096 typed edges (traveled_with, paid_by, employed_by, victim_of)
#   - concordance_complete/documents 1.4M documents with email headers + custodians
#   - redaction_analysis_v2/redactions 2.6M redaction locations, 107K entities
#   - image_analysis/images          92K images with AI descriptions
#   - transcripts/transcripts        1,628 audio/video transcripts (190K words)
#   - email_metadata/emails          ~500K parsed email headers + threading
#   - secondary_stamps/document_stamps  835K cross-reference numbers
#   - page_classifications/document_types  1.4M document type classifications
#   - handwriting_transcriptions/transcriptions  362 handwritten pages
#
# After pull, run extract_high_signal.py to derive the committed high-signal slices.

set -e
cd "$(dirname "$0")"

BASE="https://epstein-data.com"
UA="BotwaveBomba-Mirror/1.0 (ai-input=yes; news/journalism research)"

pull() {
    local db=$1 table=$2 name=$3
    echo "  $name..."
    curl -s -A "$UA" -o "${name}.json" "${BASE}/${db}/${table}.json?_size=6000&_shape=array"
    local size=$(stat -c %s "${name}.json" 2>/dev/null || echo 0)
    echo "    $(numfmt --to=iec --suffix=B $size 2>/dev/null || echo "$size bytes")"
}

echo "Mirroring from $BASE (Public Law 119-38; ai-input=yes)..."
echo
pull knowledge_graph entities kg_entities
pull knowledge_graph relationships kg_relationships
pull concordance_complete documents concordance_documents
pull redaction_analysis_v2 redactions redaction_locations
pull image_analysis images image_analysis
pull transcripts transcripts transcripts
pull email_metadata emails email_metadata
pull secondary_stamps document_stamps secondary_stamps
pull page_classifications document_types page_classifications
pull handwriting_transcriptions transcriptions handwriting_transcriptions

echo
echo "Raw mirror complete. Run extract_high_signal.py to derive the page-loadable slices."
