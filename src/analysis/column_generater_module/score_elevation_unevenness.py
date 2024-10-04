from geopandas import GeoDataFrame
from pandas import Series
from ...core.convert_range import convert_range


def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        elevation_unevenness_count = x.elevation_unevenness_count
        # 1-10の範囲を(0.3-1)に変換する。
        max = 10
        if elevation_unevenness_count <= 0:
            return 0
        elif elevation_unevenness_count >= max:
            return 1
        
        old_min, old_max = 1, max
        new_min, new_max = 0.3, 1
        converted_value = convert_range(elevation_unevenness_count, old_min, old_max, new_min, new_max)
        return converted_value

    series = gdf.apply(func, axis=1)
    return series
