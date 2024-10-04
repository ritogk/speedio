from geopandas import GeoDataFrame
from pandas import Series
import numpy as np

# 目視検証データから道幅を評価する
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        score_corner_week = row.score_corner_week
        score_corner_medium = row.score_corner_medium
        score_corner_strong = row.score_corner_strong
        score_corner_none = row.score_corner_none
        # a, b, c, d の4つの値
        values = [score_corner_week, score_corner_medium, score_corner_strong, score_corner_none]

        max_val = max(values)
        min_val = min(values)

        # 正規化定数 k を設定（必要に応じて調整）
        k = 1.0

        # 評価値の計算
        score = 1 - (max_val - min_val) / k

        return score

    series = gdf.apply(func, axis=1)
    return series