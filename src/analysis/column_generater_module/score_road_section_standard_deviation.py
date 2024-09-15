from geopandas import GeoDataFrame
from pandas import Series
import numpy as np

# 目視検証データから道幅を評価する
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        score_week_corner = row.score_week_corner
        score_medium_corner = row.score_medium_corner
        score_strong_corner = row.score_strong_corner
        score_straight = row.score_straight
        # a, b, c, d の4つの値
        values = [score_week_corner, score_medium_corner, score_strong_corner, score_straight]

        max_val = max(values)
        min_val = min(values)

        # 正規化定数 k を設定（必要に応じて調整）
        k = 1.0

        # 評価値の計算
        score = 1 - (max_val - min_val) / k

        return score

    series = gdf.apply(func, axis=1)
    return series