from geopandas import GeoDataFrame
from pandas import Series
import pandas as pd
import numpy as np


# エッジの幅を求める
def generate(gdf: GeoDataFrame) -> Series:
    if "source" not in gdf.columns:
        return np.zeros(len(gdf), dtype=int)

    # yh:WIDTHタグが存在していて、YahooJapan/ALPSMAPのデータを含む場合は、alpsmapの道幅を持っている。
    def format(x) -> int:
        yh_width_checked = False
        yh_width = x["yh:WIDTH"]
        if isinstance(yh_width, str):
            yh_width_checked = True

        source_checked = False
        source = x["source"]
        if isinstance(source, str):
            # xにYahooJapan/ALPSMAPの文字列が含まれるかどうか
            source_checked = True if "YahooJapan/ALPSMAP" in x else False
        elif isinstance(source, list):
            # listの中にYahooJapan/ALPSMAPの文字列が含まれるかどうか
            source_checked = any("YahooJapan/ALPSMAP" in item for item in source)
        return 1 if yh_width_checked and source_checked else 0

    return gdf.apply(format, axis=1)
