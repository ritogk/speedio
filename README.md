# speedio

運転が楽しいと感じるワインディングを抽出するスクリプト

## 抽出したワインディング

![image](https://github.com/ritogk/speedio/assets/72111956/9c29dc11-b058-4f5f-8ffa-31d3857a792d)

## app setup

```
cp .base.env .env
conda env create -f environment.yml
```

## conda run

```
conda activate touge-searcher
```

## data setup

```
cd converter/geotiff
# 1. 基盤地図情報DLページから全国のdem10DLする。
# 2.株式会社エコリスのソフトでtifに変換する。jpd2000とjpd2011が混じってると変換してくれないので適当なスクリプトを書いて絞り込むと良い。
# 3. python3 convert-epsg-4326-tif.pyでtifのepsgを4326に変換
# 4. python3 merge.pyで日本全国のgeotifを作成
# 5. elevation.tif二リネームしてプロジェクトのルートにおく。
```

## conda env update

```
conda env export -n touge-searcher > environment.yml
```
