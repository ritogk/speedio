from geopandas import GeoDataFrame
from pandas import Series
import pandas as pd
from .core.smoother import generate_moving_average

WINDOW_SIZE = 5
# 標高を平準化する
def generate(gdf: GeoDataFrame) -> Series:

    def func(row):
        series = pd.Series(row.elevation)
        elevations = generate_moving_average(series, WINDOW_SIZE).to_list()
        # 少数第1桁以下を切り捨てる
        elevations = [round(elevation, 1) for elevation in elevations]
        return elevations

    results = gdf.apply(func, axis=1)
    return results
