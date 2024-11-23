#!/bin/bash

S3_BUCKET="s3://speediomainstack-createbucketefe7ef15-bdy9vvhyqygf"

TARGETS_SOURCE_DIR="/home/ubuntu/speedio/html/targets"
TERRAIN_ELEVATIONS_SOURCE_DIR="/home/ubuntu/speedio/html/terrain_elevations"

echo "start s3 upload"

# S3にアップロード（Content-TypeとContent-Encodingを指定）
find "$TARGETS_SOURCE_DIR" -type f -name "*.json" | while read -r file; do
   aws s3 cp "$file" "${S3_BUCKET}/targets/${file#$TARGETS_SOURCE_DIR/}" --content-type application/json
done

echo "start terrain_elevations s3 upload"

# S3にアップロード（Content-TypeとContent-Encodingを指定）
find "$TERRAIN_ELEVATIONS_SOURCE_DIR" -type f -name "*.json" | while read -r file; do
   aws s3 cp "$file" "${S3_BUCKET}/terrain_elevations/${file#$TERRAIN_ELEVATIONS_SOURCE_DIR/}"
done
