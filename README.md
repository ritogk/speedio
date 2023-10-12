# speedio

## タスク
[済] ワインディングを抽出する評価関数をざっくり作る  
評価関数に高低差をふくめる    
評価関数に信号をふくめる  
UI作成  
API作成  

## 抽出したワインディング
青 = 候補  
赤 = 有力候補  
![image](https://github.com/ritogk/speedio/assets/72111956/65daca0c-838f-4dcf-88cc-7ba7c43c439f)




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
