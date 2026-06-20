#!/bin/bash
set -euo pipefail

S3_BUCKET="${1:?Usage: gzip_upload_s3.sh <s3-bucket-name>}"

TARGETS_SOURCE_DIR="/home/ubuntu/speedio/data/targets"
TARGETS_DEST_DIR="/home/ubuntu/speedio/data/targets_gzip"
TERRAIN_ELEVATIONS_SOURCE_DIR="/home/ubuntu/speedio/data/terrain_elevations"
TERRAIN_ELEVATIONS_DEST_DIR="/home/ubuntu/speedio/data/terrain_elevations_gzip"

echo "Uploading (gzip) to: s3://${S3_BUCKET}"

echo "start gzip targets"
rm -rf "$TARGETS_DEST_DIR"
cp -r "$TARGETS_SOURCE_DIR" "$TARGETS_DEST_DIR"
find "$TARGETS_DEST_DIR" -type f -name "*.json" | while read -r file; do
  gzip -c "$file" > "$file.gz" && mv "$file.gz" "$file"
done
echo "done gzip targets"

echo "start gzip terrain_elevations"
rm -rf "$TERRAIN_ELEVATIONS_DEST_DIR"
cp -r "$TERRAIN_ELEVATIONS_SOURCE_DIR" "$TERRAIN_ELEVATIONS_DEST_DIR"
find "$TERRAIN_ELEVATIONS_DEST_DIR" -type f -name "*.json" | while read -r file; do
  gzip -c "$file" > "$file.gz" && mv "$file.gz" "$file"
done
echo "done gzip terrain_elevations"

echo "start s3 upload"
find "$TARGETS_DEST_DIR" -type f -name "*.json" | while read -r file; do
  aws s3 cp "$file" "s3://${S3_BUCKET}/targets/${file#$TARGETS_DEST_DIR/}" \
    --content-type application/json --content-encoding gzip \
    --cache-control "public, max-age=2592000"
done

find "$TERRAIN_ELEVATIONS_DEST_DIR" -type f -name "*.json" | while read -r file; do
  aws s3 cp "$file" "s3://${S3_BUCKET}/terrain_elevations/${file#$TERRAIN_ELEVATIONS_DEST_DIR/}" \
    --content-type application/json --content-encoding gzip \
    --cache-control "public, max-age=2592000"
done

rm -rf "$TARGETS_DEST_DIR" "$TERRAIN_ELEVATIONS_DEST_DIR"
echo "done"
