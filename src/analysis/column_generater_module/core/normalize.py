import pandas as pd


# 最小値と最大値の範囲を0~1に変換する
# 最も低い値は0になる
def min_max(series: pd.Series) -> pd.Series:
    pd.Series
    min = series.min()
    max = series.max()
    return (series - min) / (max - min)
