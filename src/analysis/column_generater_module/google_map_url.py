from geopandas import GeoDataFrame, GeoSeries
from pandas import Series


# 開始、中央、終了地点からgoogleMapのルートURLを作成する
def generate(gdf: GeoDataFrame) -> Series:
    def func(row: GeoSeries):
        coords = row.geometry.coords
        center_point = coords[len(coords) // 2]
        return f"https://www.google.co.jp/maps/dir/My+Location/{row.start_point[1]},{row.start_point[0]}/{center_point[1]},{center_point[0]}/{row.end_point[1]},{row.end_point[0]}"

    series = gdf.apply(func, axis=1)
    return series
