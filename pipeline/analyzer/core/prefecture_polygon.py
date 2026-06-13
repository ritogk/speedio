import geopandas as gpd
from shapely.geometry import MultiPolygon

# geojson内の県単位のマルチポリゴンから指定した県のマルチポリゴンを取得する
def find_prefecture_polygon(geojson_path: str, prefecture_name: str) -> MultiPolygon:
    # GeoJSONファイルを読み込む
    associations_gdf = gpd.read_file(geojson_path)
    # 指定したnameに基づいて県協会のMultiPolygonを取得
    multipolygon = associations_gdf[associations_gdf['name'] == prefecture_name].geometry.values[0]
    # # 県の境界をこぼさないようにポリゴンを拡大（単位はメートル、例: 2000メートル拡大）
    expanded_polygon = multipolygon.buffer(0.02)  # 0.02度、約2000メートル

    # # GeoDataFrameに変換して保存
    # expanded_gdf = gpd.GeoDataFrame(geometry=[expanded_polygon], crs="EPSG:4326")
    # # GeoJSON形式でファイルに保存
    # expanded_gdf.to_file("./expanded_polygon.geojson", driver="GeoJSON")
    return expanded_polygon