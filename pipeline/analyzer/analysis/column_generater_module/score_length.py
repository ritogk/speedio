from geopandas import GeoDataFrame
from pandas import Series
from ...core.convert_range import convert_range

# 距離のスコアを求める
# 距離をスコア含めないと短い距離で特徴量が詰まった道の評価が高くなってしまう。
def generate(gdf: GeoDataFrame) -> Series:
    def func(length: int):
        old_min, old_max = 3000, 8000
        new_min, new_max = 0.5, 1
        if length >= old_max:
            score = 1
        else:
            score = convert_range(length, old_min, old_max, new_min, new_max)
        return score

    series = gdf["length"].apply(func)
    return series
