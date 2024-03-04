from geopandas import GeoDataFrame
from pandas import Series
from .core import normalize


def generate(gdf: GeoDataFrame) -> Series:
    series = normalize.min_max(gdf["angle_and_length_radio"])
    return series
