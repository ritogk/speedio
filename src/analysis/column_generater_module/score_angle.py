from geopandas import GeoDataFrame
from pandas import Series


def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        min = 0
        max = 0.6
        if x > max:
            return 1
        return (x - min) / (max - min)

    series = gdf["angle_and_length_ratio"].apply(func)
    return series
