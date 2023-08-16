# speedio

## なにこれ？
車との対話に集中できるナビアプリです。
一般的なナビアプリはそれなりの道幅がある最短経路を通って目的に案内するが、この道は歩行者、交差点が多い。
そのため不確定な外の状況に意識が向いてしまい運転に集中できない。
不確定要素を可能な限り排除した道を通って目的地までに案内するナビアプリがほしいと思って作ってます。


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
