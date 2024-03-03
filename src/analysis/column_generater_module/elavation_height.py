from geopandas import GeoDataFrame
from pandas import Series
from .core import elevetion_service
import pandas as pd


# 標高の高さを求める。
def generate(gdf: GeoDataFrame) -> Series:

    def func(row) -> int:
        series = pd.Series(row.elevation_smooth)
        # 最初値と最大値の差を求める。
        height = series.max() - series.min()
        return height

    results = gdf.apply(func, axis=1)
    return results
