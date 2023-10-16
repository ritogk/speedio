# speedio

## タスク
[済] ワインディングを抽出する評価関数をざっくり作る  
[済] 評価関数に高低差をふくめる  
高度をgoogle elevation apiからではなくて基盤地図情報のデータから取得する(金がかかるので)  
UI作成  
JupyterNoteBookのコードをAPI化   

## 抽出したワインディング
青 = 候補  
赤 = 有力候補  
![image](https://github.com/ritogk/speedio/assets/72111956/65daca0c-838f-4dcf-88cc-7ba7c43c439f)
![image](https://github.com/ritogk/speedio/assets/72111956/6a78e25b-bf97-49c3-a75e-8485a703c90e)
![image](https://github.com/ritogk/speedio/assets/72111956/337cae88-06b1-44f2-b902-38beb4bd5177)





## flask起動
```
flask --app server run
```


## イメージ
![tizu](https://github.com/ritogk/speedio/assets/72111956/45f0e260-7a98-4e1a-8178-4b9bad5fdb3b)

## setup
```
python3 -m venv env
source env/bin/activate
pip install -r ./requirements.txt
```

## add pip list
```
pip freeze > requirements.txt
```

## jupyter notebook起動
```
jupyter notebook
```

## jupyer notebookで自動補完を動かす
```
jupyter nbextensions_configurator enable

```
Nbextentionsタブ内のHinterlandを有効にする

## venv
```
# 仮想環境作成
python3 -m venv env
# 仮想環境を有効にする
source env/bin/activate
# 仮想環境を無効にする
deactivate
```
