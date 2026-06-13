from geopandas import GeoDataFrame
from pandas import Series
import numpy as np

# 各コーナーのバランスを評価する
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        score_corner_week = row.score_corner_week
        score_corner_medium = row.score_corner_medium
        score_corner_strong = row.score_corner_strong
        score_corner_none = row.score_corner_none
        
        values = [score_corner_week, score_corner_medium, score_corner_strong, score_corner_none]

        # 正規化定数 k を設定（必要に応じて調整）大きくするほど標準偏差の影響が小さくなる。
        k = 0.4

        # 標準偏差を計算
        std_dev = np.std(values)
        # print(std_dev)

        # 評価値の計算
        score = 1 - (std_dev / k)
        # print(score)

        return score

    series = gdf.apply(func, axis=1)
    return series