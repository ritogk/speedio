#!/bin/bash

S3_BUCKET="s3://speediomainstack-createbucketefe7ef15-bdy9vvhyqygf"

TARGETS_SOURCE_DIR="/home/ubuntu/speedio/html/targets"
TERRAIN_ELEVATIONS_SOURCE_DIR="/home/ubuntu/speedio/html/terrain_elevations"

# プログレスバー関数
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

echo "Start S3 upload for targets"

# ファイルリストの取得
files=($(find "$TARGETS_SOURCE_DIR" -type f -name "*.json"))
total_files=${#files[@]}

if (( total_files > 0 )); then
    current=0
    for file in "${files[@]}"; do
        aws s3 cp "$file" "${S3_BUCKET}/targets/${file#$TARGETS_SOURCE_DIR/}" >/dev/null 2>&1
        ((current++))
        show_progress "$current" "$total_files"
    done
    echo -e "\nUpload completed for targets."
else
    echo "No target files to upload."
fi

echo "Start S3 upload for terrain elevations"

# ファイルリストの取得
files=($(find "$TERRAIN_ELEVATIONS_SOURCE_DIR" -type f -name "*.json"))
total_files=${#files[@]}

if (( total_files > 0 )); then
    current=0
    for file in "${files[@]}"; do
        aws s3 cp "$file" "${S3_BUCKET}/terrain_elevations/${file#$TERRAIN_ELEVATIONS_SOURCE_DIR/}" >/dev/null 2>&1
        ((current++))
        show_progress "$current" "$total_files"
    done
    echo -e "\nUpload completed for terrain elevations."
else
    echo "No terrain elevation files to upload."
fi
