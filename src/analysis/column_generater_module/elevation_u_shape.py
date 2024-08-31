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
        return (1 if ratio > 0.8 else ratio) * (fluctuation_up + fluctuation_down)

    series = gdf.apply(func, axis=1)

    return series
