from geopandas import GeoDataFrame
from pandas import Series
import math


def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        # row.geometry配列の中央の値を抽出する
        center_index = math.floor(len(row.geometry.coords) / 2) - 1
        center = row.geometry.coords[center_index]
        return f"https://earth.google.com/web/search/{center[0]},+{center[1]}"

    series = gdf.apply(func, axis=1)
    return series
