from geopandas import GeoDataFrame
from pandas import Series
import pandas as pd
from .core.smoother import generate_moving_average

WINDOW_SIZE = 5
# 標高を平準化する
def generate(gdf: GeoDataFrame) -> Series:

    def func(row):
        series = pd.Series(row.elevation)
        return generate_moving_average(series, WINDOW_SIZE).to_list()

    results = gdf.apply(func, axis=1)
    return results
