# speedio

## タスク

[済] ワインディングを抽出する評価関数をざっくり作る  
[済] 評価関数に高低差をふくめる  
[済] 高度を google elevation api からではなくて基盤地図情報のデータから取得する(金がかかるので)  
[] 抽出した道をまとめて検証できるルートを自動生成できるようにする  
[] 見通しの良い道を評価する関数を作る  
[] 左コーナーの重みを上げる  
[] みてい


## 抽出したワインディング

青 = 候補  
赤 = 有力候補  
<img width="1001" alt="image" src="https://github.com/ritogk/speedio/assets/72111956/0c25fcae-71e9-46b0-88a2-2f3f43113350">

有力候補のワインディングサンプル  
![image](https://github.com/ritogk/speedio/assets/72111956/6a78e25b-bf97-49c3-a75e-8485a703c90e)
![image](https://github.com/ritogk/speedio/assets/72111956/337cae88-06b1-44f2-b902-38beb4bd5177)

## setup

```
conda env create -f environment.yml
```

## conda run

```
conda activate touge-searcher
```
