from geopandas import GeoDataFrame
from pandas import Series
from .core import elevetion_service
import pandas as pd


# 標高を平準化する
def generate(gdf: GeoDataFrame) -> Series:
    window_size = 5

    def func(row):
        series = pd.Series(row.elevation)
        # 移動平均でサンプリング4で平滑化する。平準化の影響で3つのデータが削除される。
        smooth = series.rolling(window=window_size).mean().dropna().tolist()
        return smooth

    results = gdf.apply(func, axis=1)
    return results
