#!/bin/bash
# F09 — Extraire une seule frame d'une vidéo via FFmpeg
# Usage: bash scripts/extract_frame.sh <video_path> <frame_number>
# Exemple: bash scripts/extract_frame.sh video.mp4 300

set -e

VIDEO="${1:?Usage: extract_frame.sh <video_path> <frame_number>}"
FRAME_NUM="${2:?Usage: extract_frame.sh <video_path> <frame_number>}"
OUTPUT_DIR="F09_PREVIEW/CODEBASE/public"
OUTPUT="${OUTPUT_DIR}/frame.png"

mkdir -p "$OUTPUT_DIR"

ffmpeg -y -i "$VIDEO" \
  -vf "select=eq(n\\,$FRAME_NUM)" \
  -vframes 1 \
  -q:v 1 \
  "$OUTPUT" \
  2>/dev/null

echo "✅ Frame $FRAME_NUM extraite → $OUTPUT"
