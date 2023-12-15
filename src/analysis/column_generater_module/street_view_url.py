from geopandas import GeoDataFrame
from pandas import Series


def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        return f"https://www.google.com/maps/@{row.start_point[1]},{row.start_point[0]},20?layer=c&cbll={row.end_point[1]},{row.end_point[0]}&cbp=12,0,0,0,0"

    series = gdf.apply(func, axis=1)
    return series
