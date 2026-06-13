from geopandas import GeoDataFrame
from pandas import Series
from pyproj import Proj, Transformer

def generate(gdf: GeoDataFrame, plane_epsg_code: int) -> Series:
    def func(row):
        # 緯度経度のリスト
        coords = row.geometry_list

        # WGS84 (緯度経度) 座標系
        wgs84 = Proj('epsg:4326')

        # 日本の平面直角座標系（ここではゾーン9を例とする）
        japan_plane = Proj(f"epsg:{plane_epsg_code}")

        # Transformer オブジェクトの作成
        transformer = Transformer.from_proj(wgs84, japan_plane)

        # itransform を使用して座標リスト全体を変換
        transformed_coords = list(transformer.itransform(coords))

        # transformed_coordsのxとyを整数に変換
        transformed_coords = [(int(x), int(y)) for x, y in transformed_coords]
        return transformed_coords

    series = gdf.apply(func, axis=1)

    return series
