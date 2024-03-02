from geopandas import GeoDataFrame
from pandas import Series


def generate(gdf: GeoDataFrame) -> Series:
    series = gdf["score"] / gdf["score"].max()
    return series
