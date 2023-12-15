from geopandas import GeoDataFrame
from pandas import Series


def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        return f"https://www.google.co.jp/maps/dir/{row.start_point[1]},{row.start_point[0]}/'{row.end_point[1]},{row.end_point[0]}'"

    series = gdf.apply(func, axis=1)
    return series
