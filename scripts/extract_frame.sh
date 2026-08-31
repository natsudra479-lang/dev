#!/bin/bash
# F09 — Extraire une seule frame d'une vidéo via FFmpeg
# Usage: bash scripts/extract_frame.sh <video_path> <time_seconds>
# Exemple: bash scripts/extract_frame.sh video.mp4 5        → frame à 5s
#          bash scripts/extract_frame.sh video.mp4 5.25     → frame à 5.25s
#          bash scripts/extract_frame.sh video.mp4 frame:300 → frame #300 (legacy)

set -e

VIDEO="${1:?Usage: extract_frame.sh <video_path> <time_seconds | frame:N>}"
TIME_INPUT="${2:?Usage: extract_frame.sh <video_path> <time_seconds | frame:N>}"
OUTPUT_DIR="F09_PREVIEW/CODEBASE/public"
OUTPUT="${OUTPUT_DIR}/frame.png"

mkdir -p "$OUTPUT_DIR"

# Parse input: seconds (default) or frame:N
if [[ "$TIME_INPUT" == frame:* ]]; then
  FRAME_NUM="${TIME_INPUT#frame:}"
  echo "⏳ Extraction frame #$FRAME_NUM..."
  ffmpeg -y -i "$VIDEO" \
    -vf "select=eq(n\\,$FRAME_NUM)" \
    -vframes 1 \
    -q:v 1 \
    "$OUTPUT" \
    2>/dev/null
  echo "✅ Frame #$FRAME_NUM extraite → $OUTPUT"
else
  EXTRACT_SEC="$TIME_INPUT"
  echo "⏳ Extraction à ${EXTRACT_SEC}s..."
  ffmpeg -y -ss "$EXTRACT_SEC" -i "$VIDEO" \
    -vframes 1 \
    -q:v 1 \
    "$OUTPUT" \
    2>/dev/null
  echo "✅ Frame à ${EXTRACT_SEC}s extraite → $OUTPUT"
fi
