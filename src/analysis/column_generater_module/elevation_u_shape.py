from geopandas import GeoDataFrame
from pandas import Series


# 標高のU字型の特徴量を求める
# = (標高の増加の総和と標高の減少の総和の比率 ) * (標高の増加の総和 + 標高の減少の総和)
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        fluctuation_up = row.elevation_fluctuation[0]
        fluctuation_down = row.elevation_fluctuation[1]
        ratio = 0

        if fluctuation_up == 0 or fluctuation_down == 0:
            return 0

        if fluctuation_up > fluctuation_down:
            ratio = fluctuation_down / fluctuation_up
        else:
            ratio = fluctuation_up / fluctuation_down

         # up, downの比率が完全にイコールの場合に評価値が上がるのはおかしいので0.8を上限とする
        adjusted_ratio = (1 if ratio > 0.8 else ratio)
        
        # ★row.elevation_heightが30以下の場合に応じて値を下げる。
        if row.elevation_height < 30:
            adjusted_ratio *= (row.elevation_height / 30)
        
        # 標高の最大値が大きすぎると評価値が上がってしまうので上限を300に設定
        adjusted_elevation_height = 300 if row.elevation_height >= 300 else row.elevation_height
        return adjusted_ratio * adjusted_elevation_height

    series = gdf.apply(func, axis=1)

    return series
