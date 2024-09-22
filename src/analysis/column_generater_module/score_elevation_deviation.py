from geopandas import GeoDataFrame
from pandas import Series

# 目視検証データから道幅を評価する
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        elevation_fluctuation_up, elevation_fluctuation_down = row["elevation_fluctuation"]
        min_val = min(elevation_fluctuation_up, elevation_fluctuation_down)
        max_val = max(elevation_fluctuation_up, elevation_fluctuation_down)

        return min_val / max_val

    series = gdf.apply(func, axis=1)
    return series