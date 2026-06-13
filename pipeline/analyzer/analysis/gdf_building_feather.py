import osmnx as ox
from geopandas import GeoDataFrame

# 建物のジオメトリーを取得する
def fetch_gdf(
    latitude_start, longitude_start, latitude_end, longitude_end
) -> GeoDataFrame | None:
    # キャッシュを使う
    ox.settings.use_cache = True
    ox.settings.log_console = False
    try:
        gdf_buildings = ox.features_from_bbox(
            north=max(latitude_start, latitude_end),
            south=min(latitude_start, latitude_end),
            east=max(longitude_start, longitude_end),
            west=min(longitude_start, longitude_end),
            tags={'building': True}
        )
    except Exception as e:
        print(f"エラーが発生しました: {e}")
        return None

    return gdf_buildings
