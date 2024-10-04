from geopandas import GeoDataFrame

# 区間数が少ない道を除外する
MIN_COUNT = 13
def remove(gdf: GeoDataFrame) -> GeoDataFrame:
    return gdf[gdf["road_section_cnt"] >= MIN_COUNT]
