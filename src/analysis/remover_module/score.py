from geopandas import GeoDataFrame


def remove(gdf: GeoDataFrame) -> GeoDataFrame:
    return gdf[gdf["score"] > 0.005]
