#!/bin/bash
set -euo pipefail

S3_BUCKET="${1:?Usage: upload_s3.sh <s3-bucket-name> [pref_code]}"
PREF_CODE="${2:-}"

TARGETS_SOURCE_DIR="/home/ubuntu/speedio/data/targets"
TERRAIN_ELEVATIONS_SOURCE_DIR="/home/ubuntu/speedio/data/terrain_elevations"

if [ -n "$PREF_CODE" ]; then
  TARGETS_FIND_DIR="${TARGETS_SOURCE_DIR}/${PREF_CODE}"
  TERRAIN_FIND_DIR="${TERRAIN_ELEVATIONS_SOURCE_DIR}/${PREF_CODE}"
else
  TARGETS_FIND_DIR="$TARGETS_SOURCE_DIR"
  TERRAIN_FIND_DIR="$TERRAIN_ELEVATIONS_SOURCE_DIR"
fi

show_progress() {
  local current=$1
  local total=$2
  local bar_length=50
  local progress=$(( current * bar_length / total ))
  printf "\r["
  for ((i = 0; i < bar_length; i++)); do
    if (( i < progress )); then
      printf "="
    else
      printf " "
    fi
  done
  printf "] %d%% (%d/%d)" $(( current * 100 / total )) "$current" "$total"
}

echo "Uploading to: s3://${S3_BUCKET} (prefecture: ${PREF_CODE:-all})"

echo "Start S3 upload for targets"
files=($(find "$TARGETS_FIND_DIR" -type f -name "*.json" 2>/dev/null))
total_files=${#files[@]}

if (( total_files > 0 )); then
  current=0
  for file in "${files[@]}"; do
    aws s3 cp "$file" "s3://${S3_BUCKET}/targets/${file#$TARGETS_SOURCE_DIR/}" >/dev/null 2>&1
    ((current++))
    show_progress "$current" "$total_files"
  done
  echo -e "\nUpload completed for targets."
else
  echo "No target files to upload."
fi

echo "Start S3 upload for terrain elevations"
files=($(find "$TERRAIN_FIND_DIR" -type f -name "*.json" 2>/dev/null))
total_files=${#files[@]}

if (( total_files > 0 )); then
  current=0
  for file in "${files[@]}"; do
    aws s3 cp "$file" "s3://${S3_BUCKET}/terrain_elevations/${file#$TERRAIN_ELEVATIONS_SOURCE_DIR/}" >/dev/null 2>&1
    ((current++))
    show_progress "$current" "$total_files"
  done
  echo -e "\nUpload completed for terrain elevations."
else
  echo "No terrain elevation files to upload."
fi
