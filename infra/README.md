# speedio infra

## setup

1. route53 で事前にドメインを取得する
2. 以下のコマンド実行

```
npx cdk deploy --all
```

ACM の証明書が有効になるまで 10 分くらいかかるので待つ。
