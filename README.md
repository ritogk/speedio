# speedio

運転が楽しいと感じるワインディングを抽出するスクリプト

## 抽出したワインディング

![image](https://github.com/ritogk/speedio/assets/72111956/9c29dc11-b058-4f5f-8ffa-31d3857a792d)

## setup

```
cp .base.env .env
conda env create -f environment.yml
```

## conda run

```
conda activate touge-searcher
```

# rcc

```
cp rcc/web/.base.env rcc/web/.env
cd rcc/web/.cert
mkcert install
mkcert localhost
```
