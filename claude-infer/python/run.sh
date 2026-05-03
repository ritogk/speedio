#!/bin/bash
# ViT-Centerline ML環境起動スクリプト

# conda環境をアクティベート
source ~/anaconda3/etc/profile.d/conda.sh
conda activate vit-centerline

# プロジェクトディレクトリに移動
cd "$(dirname "$0")"

# 引数があればそのコマンドを実行、なければインタラクティブシェル
if [ $# -gt 0 ]; then
    python "$@"
else
    echo "=== ViT-Centerline ML Environment ==="
    echo "conda env: vit-centerline"
    echo "Python: $(python --version)"
    echo ""
    echo "Available commands:"
    echo "  python prepare_data.py    # データ準備"
    echo "  python train.py           # 学習"
    echo "  python evaluate.py        # 評価"
    echo "  python server.py          # 推論サーバー起動"
    echo ""
    exec bash
fi
