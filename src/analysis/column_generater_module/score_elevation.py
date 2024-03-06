from geopandas import GeoDataFrame
from pandas import Series


# 標高を評価する
# 距離と標高の比率が0.08mを超える場合は1とする。
def generate(gdf: GeoDataFrame) -> Series:
    series = gdf["elavation_height_and_length_ratio"] / 0.08
    ## 1以上の値は1とする
    series = series.apply(lambda x: 1 if x > 1 else x)
    return series
