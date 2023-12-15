from geopandas import GeoDataFrame
from pandas import Series


def generate(gdf: GeoDataFrame) -> Series:
    series = gdf["elevation_change_rate"] * gdf["angle_change_rate"]
    return series
