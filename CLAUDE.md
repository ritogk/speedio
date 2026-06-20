# CLAUDE.md

## デプロイフロー（旧viewer: tools/viewer/）

1単位の作業が完了したら、以下を一連で実行する:

1. `git add` + `git commit`（変更内容に応じたコミットメッセージ）
2. `git push`
3. `aws s3 cp tools/viewer/index_3.html s3://speedio-old-viewer-788594208758/index_3.html`
4. `aws cloudfront create-invalidation --distribution-id EBM4FK68PMJX0 --paths "/index_3.html"`

対象は **old環境（speedio-old-viewer / CloudFront: EBM4FK68PMJX0）のみ**。prod/dev環境は対象外。
