from geopandas import GeoDataFrame


# 標高の変化が少ないエッジを削除する
def remove(gdf: GeoDataFrame) -> GeoDataFrame:
    return gdf[gdf["elevation_height_and_length_ratio"] > 0.02]
