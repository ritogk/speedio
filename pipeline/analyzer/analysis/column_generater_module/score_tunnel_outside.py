from geopandas import GeoDataFrame
from pandas import Series

# トンネル外区間の割合の評価を行う
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        ratio = row["tunnel_length"] / row["length"]
        return 1 - ratio

    series = gdf.apply(func, axis=1)
    return series
