from geopandas import GeoDataFrame
from pandas import Series

# 各ラインの標高リストから最小標高値を取得する

def generate_min_elevation(gdf: GeoDataFrame) -> Series:
    def get_min_elevation(elevations):
        if not elevations or len(elevations) == 0:
            return None
        return min(elevations)
    # gdf["elevation"]はリスト（各ラインの標高値リスト）
    return gdf["elevation"].apply(get_min_elevation)
