from geopandas import GeoDataFrame
from pandas import Series


def generate(gdf: GeoDataFrame) -> Series:
    series = gdf["angle_and_length_radio"] / gdf["angle_and_length_radio"].max()
    return series
