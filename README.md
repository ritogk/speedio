# speedio

運転が楽しいと感じるワインディングを抽出するスクリプト

## 抽出したワインディング

![image](https://github.com/user-attachments/assets/8798ffff-2cfc-4f02-8c32-f0050b1f1b5d)

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
# 1. 基盤地図情報DLページから全国のdem10DL(gml)をDLする。
# 2. gmlはjpd2000とjpd2011が混じってる状態なのでスクリプトで仕分ける
```

grep -rl '<gml:Envelope srsName="fguuid:jgd2011.bl">' . | xargs -I {} mv {} ./jgd2011
grep -rl '<gml:Envelope srsName="fguuid:jgd2000.bl">' . | xargs -I {} mv {} ./jgd2000

```
# 3. 株式会社エコリスのソフトで全国のtifに変換する。
# 4. tifをepsg:4326に変換
```

python3 convert_tif_epsg_4326.py

```
# 5. tifをマージ
```

python3 merge_tif.py

```
# 6. elevation.tifにリネームしてプロジェクトのルートにおく
```

## conda env update

```
conda env export -n touge-searcher > environment.yml
```
