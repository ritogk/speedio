from geopandas import GeoDataFrame
from pandas import Series


# 距離のスコアを求める
# 距離をスコア含めないと短い距離で特徴量が詰まった道の評価が高くなってしまう。
def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        min = 1000
        max = 4000
        if x > max:
            return 1
        return (x - min) / (max - min)

    series = gdf["length"].apply(func)
    return series
