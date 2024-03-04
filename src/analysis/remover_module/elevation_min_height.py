from geopandas import GeoDataFrame


# 逆方向のエッジを削除する
def remove(gdf: GeoDataFrame) -> GeoDataFrame:
    return gdf[gdf["elavation_height_and_length_ratio"] > 0.02]
