from geopandas import GeoDataFrame
from pandas import Series
from ...core.convert_range import convert_range

HEIGHT_WEIGHT = 2

# 標高を評価する
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        elevation_height = row["elevation_height"]
        # 30-300を0.35~1の範囲に変換
        old_min, old_max = 30, 300
        new_min, new_max = 0.35, 1
        
        initial_value = 0
        if elevation_height >= old_max:
            initial_value = 1
        else:
            initial_value = convert_range(elevation_height, old_min, old_max, new_min, new_max)
        
        # 標高が500以上の場合は評価値を減らす
        subtrahend = 0
        if elevation_height >= 500:
            old_min, old_max = 500, 1000
            new_min, new_max = 0.5, 1
            if elevation_height >= old_max:
                subtrahend = 1
            else:
                subtrahend = convert_range(elevation_height, old_min, old_max, new_min, new_max)
        return initial_value - subtrahend
    series = gdf.apply(func, axis=1)
    return series
