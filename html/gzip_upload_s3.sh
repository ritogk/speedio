#!/bin/bash

S3_BUCKET="s3://speediomainstack-createbucketefe7ef15-bdy9vvhyqygf"

TARGETS_SOURCE_DIR="/home/ubuntu/speedio/html/targets"
TARGETS_DEST_DIR="/home/ubuntu/speedio/html/targets_gzip"

echo "start gzip targets"

# 親ディレクトリをコピー
cp -r "$TARGETS_SOURCE_DIR" "$TARGETS_DEST_DIR"

# 再帰的にJSONファイルをgzip圧縮して上書き
find "$TARGETS_DEST_DIR" -type f -name "*.json" | while read -r file; do
  gzip -c "$file" > "$file.gz" && mv "$file.gz" "$file"
done

echo "done gzip targets"

TERRAIN_ELEVATIONS_SOURCE_DIR="/home/ubuntu/speedio/html/terrain_elevations"
TERRAIN_ELEVATIONS_DEST_DIR="/home/ubuntu/speedio/html/terrain_elevations_gzip"

echo "start gzip terrain_elevations"

# 親ディレクトリをコピー
cp -r "$TERRAIN_ELEVATIONS_SOURCE_DIR" "$TERRAIN_ELEVATIONS_DEST_DIR"

# 再帰的にJSONファイルをgzip圧縮して上書き
find "$TERRAIN_ELEVATIONS_DEST_DIR" -type f -name "*.json" | while read -r file; do
  gzip -c "$file" > "$file.gz" && mv "$file.gz" "$file"
done

echo "done gzip terrain_elevations"

echo "start s3 upload"

# S3にアップロード（Content-TypeとContent-Encodingを指定）
find "$TARGETS_DEST_DIR" -type f -name "*.json" | while read -r file; do
   aws s3 cp "$file" "${S3_BUCKET}/targets/${file#$TARGETS_DEST_DIR/}" --content-type application/json --content-encoding gzip
done

# S3にアップロード（Content-TypeとContent-Encodingを指定）
find "$TERRAIN_ELEVATIONS_DEST_DIR" -type f -name "*.json" | while read -r file; do
   aws s3 cp "$file" "${S3_BUCKET}/terrain_elevations/${file#$TERRAIN_ELEVATIONS_DEST_DIR/}" --content-type application/json --content-encoding gzip
done
