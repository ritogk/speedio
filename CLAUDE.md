# CLAUDE.md

## デプロイフロー（旧viewer: tools/viewer/）

1単位の作業が完了したら、以下を一連で実行する:

1. `git add` + `git commit`（変更内容に応じたコミットメッセージ）
2. `git push`
3. `aws s3 cp tools/viewer/index_3.html s3://speedio-old-viewer-788594208758/index_3.html`
4. `aws cloudfront create-invalidation --distribution-id EBM4FK68PMJX0 --paths "/index_3.html"`

対象は **old環境（speedio-old-viewer / CloudFront: EBM4FK68PMJX0）のみ**。prod/dev環境は対象外。

## データバージョン管理（tools/viewer/）

JSONデータ（targets/*.json）はブラウザに30日キャッシュさせている（`Cache-Control: public, max-age=2592000`）。
データを更新した場合、ブラウザキャッシュを破棄させるために `data-version.json` の日付を更新する必要がある。

### データ更新時の手順

slim再生成（`build_slim_targets.py`）やJSONデータの更新を行った場合は、**必ず**以下の手順でバージョンも上げること。

1. 新しいJSONデータをS3にアップロード（`upload_s3.sh` or `gzip_upload_s3.sh` or `build_slim_targets.py`）
2. `tools/viewer/data-version.json` の `v` を更新（例: `{"v":"2026-07-01"}`）
3. `data-version.json` をS3にアップ: `aws s3 cp tools/viewer/data-version.json s3://speedio-old-viewer-788594208758/data-version.json --cache-control "no-cache"`
4. CloudFront Invalidation: `aws cloudfront create-invalidation --distribution-id EBM4FK68PMJX0 --paths "/data-version.json" "/targets/*"`

### 仕組み

- ページ読み込み時にJS側で `data-version.json`（no-cache、50バイト）をfetch
- localStorageの前回バージョンと比較し、変わっていたら `cache:'reload'` でJSONを再取得
- 同じならブラウザキャッシュから即座にロード（ネットワーク不要）
