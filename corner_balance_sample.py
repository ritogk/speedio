from geopandas import GeoDataFrame
from pandas import Series
import numpy as np

WEEK_WEIGHT = 1
MEDIUM_WEIGHT = 1
STRONG_WEIGHT = 1.15 # 強コーナーは印象が強いので重みで上げる
NONE_WEIGHT = 1

score_corner_week = 0 * WEEK_WEIGHT
score_corner_medium = 0 * MEDIUM_WEIGHT
score_corner_strong = 0 * STRONG_WEIGHT
score_corner_none = 1 * NONE_WEIGHT

values = [score_corner_week, score_corner_medium, score_corner_strong, score_corner_none]

# 正規化定数 k を設定（必要に応じて調整）大きくするほど標準偏差の影響が小さくなる。
k = 0.5

# 標準偏差を計算
std_dev = np.std(values)
# print(std_dev)

# 評価値の計算
score = 1 - (std_dev / k)

print(score)