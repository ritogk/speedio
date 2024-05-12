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
        # 末尾のデータを追加することで、平準化によって削除されたデータを補完する。
        # 最後から3番目のデータは、最後から3番目以降のデータの平均とする。
        # 最後から2番目のデータは、最後から2番目と最後のデータの平均とする。
        # 最後のデータは平均せずそのまま使用する。
        if len(series) >= 3:
            # 最後から3番目以降の平均
            last3_avg = series.iloc[-3:].mean()
            # 最後から2番目以降の平均
            last2_avg = series.iloc[-2:].mean()
            # 最後のデータ
            last1 = series.iloc[-1]
            smooth.extend([last3_avg, last2_avg, last1])
        return smooth

    results = gdf.apply(func, axis=1)
    return results
