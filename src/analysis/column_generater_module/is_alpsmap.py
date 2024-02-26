from geopandas import GeoDataFrame
from pandas import Series
import pandas as pd
import numpy as np


# エッジの幅を求める
def generate(gdf: GeoDataFrame) -> Series:
    if "yh:WIDTH" not in gdf.columns:
        return np.zeros(len(gdf), dtype=int)
    # アルプスマップのデータを含む行に1を立てる
    return gdf["yh:WIDTH"].apply(lambda x: 1 if "YahooJapan/ALPSMAP" in x else 0)
