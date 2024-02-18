from geopandas import GeoDataFrame
from pandas import Series
import pandas as pd
import numpy as np


# エッジの幅を求める
def generate(gdf: GeoDataFrame) -> Series:
    # アルプスマップのデータを含む行に1を立てる
    return np.where(
        (gdf["source"] == "YahooJapan/ALPSMAP") & pd.notna(gdf["yh:WIDTH"]), 1, 0
    )
