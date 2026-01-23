#!/bin/bash

S3_BUCKET="s3://speediomainstack-createbucketefe7ef15-bdy9vvhyqygf"

# 第1引数で都道府県コードが指定された場合、その都道府県のみを対象にする
PREF_CODE="$1"

TARGETS_SOURCE_DIR="/home/ubuntu/speedio/html/targets"
TERRAIN_ELEVATIONS_SOURCE_DIR="/home/ubuntu/speedio/html/terrain_elevations"

# 処理対象ディレクトリ（都道府県コード指定の有無で切り替え）
if [ -n "$PREF_CODE" ]; then
    TARGETS_FIND_DIR="${TARGETS_SOURCE_DIR}/${PREF_CODE}"
    TERRAIN_FIND_DIR="${TERRAIN_ELEVATIONS_SOURCE_DIR}/${PREF_CODE}"
else
    TARGETS_FIND_DIR="$TARGETS_SOURCE_DIR"
    TERRAIN_FIND_DIR="$TERRAIN_ELEVATIONS_SOURCE_DIR"
fi

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

echo "Start S3 upload for targets (prefecture: ${PREF_CODE:-all})"

# ファイルリストの取得
files=($(find "$TARGETS_FIND_DIR" -type f -name "*.json" 2>/dev/null))
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

echo "Start S3 upload for terrain elevations (prefecture: ${PREF_CODE:-all})"

# ファイルリストの取得
files=($(find "$TERRAIN_FIND_DIR" -type f -name "*.json" 2>/dev/null))
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
