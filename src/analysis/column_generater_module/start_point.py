from geopandas import GeoDataFrame
from pandas import Series


def generate(gdf: GeoDataFrame) -> Series:
    series = gdf["geometry"].apply(lambda x: x.coords[0])
    return series
