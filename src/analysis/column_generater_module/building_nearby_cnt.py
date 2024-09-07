from geopandas import GeoDataFrame
from pandas import Series
from tqdm import tqdm
from geopy.distance import geodesic
from shapely.geometry import Polygon
import math

# 道路の周辺20m以内にある建物の数をカウントする
def generate(gdf: GeoDataFrame, gdf_buildings: GeoDataFrame) -> Series:
    # gdf_buildings の空間インデックスを作成
    sindex_buildings = gdf_buildings.sindex

    def func(row):
        bbox = row.geometry.bounds
        # ジオメトリーの境界ボックス内の建物のインデックスを取得
        sindex_match_indices = list(sindex_buildings.intersection(bbox))
        # 該当するインデックスから建物のジオメトリを取得
        sindex_match_buildings = gdf_buildings.iloc[sindex_match_indices]
        # LinStringから上下に20m垂直に伸ばしたポリゴンを作成する。
        polygon = create_vertical_polygon(row.geometry.coords, 20)

        match_buildings = []
        for building in sindex_match_buildings.itertuples():
            # 建物が Polygon に重なっているか確認
            if building.geometry.intersects(polygon):
                match_buildings.append(building.Index)
        # 重複を排除
        unique_buildings = list(dict.fromkeys(match_buildings))

        result = len(unique_buildings)
        return result

    tqdm.pandas()
    series = gdf.progress_apply(func, axis=1)

    return series

def calculate_bearing(lat1, lon1, lat2, lon2):
    """
    2つの座標間の方位角を計算
    """
    lat1 = math.radians(lat1)
    lon1 = math.radians(lon1)
    lat2 = math.radians(lat2)
    lon2 = math.radians(lon2)
    
    d_lon = lon2 - lon1

    x = math.sin(d_lon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - (math.sin(lat1) * math.cos(lat2) * math.cos(d_lon))
    
    initial_bearing = math.atan2(x, y)
    initial_bearing = math.degrees(initial_bearing)
    
    compass_bearing = (initial_bearing + 360) % 360
    return compass_bearing

def offset_latlon(lat, lon, distance_meters, bearing):
    """
    緯度経度座標を指定距離だけオフセットします
    :param lat: 緯度
    :param lon: 経度
    :param distance_meters: オフセットする距離（メートル）
    :param bearing: 方位角（0: 北, 90: 東, 180: 南, 270: 西）
    :return: 新しい緯度経度
    """
    origin = (lat, lon)
    destination = geodesic(meters=distance_meters).destination(origin, bearing)
    return destination.latitude, destination.longitude

def create_vertical_polygon(coords, offset_distance):
    # 元の座標を上下にオフセット
    offset_coords_up = []
    offset_coords_down = []

    for i in range(len(coords) - 1):
        lon1, lat1  = coords[i]
        lon2, lat2 = coords[i + 1]
        
        # 2座標間の方位角を計算
        bearing = calculate_bearing(lat1, lon1, lat2, lon2)
        
        # 左側と右側に90度と270度の方向にオフセット
        lat_up1, lon_up1 = offset_latlon(lat1, lon1, offset_distance, bearing + 90)
        lat_up2, lon_up2 = offset_latlon(lat2, lon2, offset_distance, bearing + 90)
        offset_coords_up.append((lon_up1, lat_up1))
        offset_coords_up.append((lon_up2, lat_up2))
        
        lat_down1, lon_down1 = offset_latlon(lat1, lon1, offset_distance, bearing - 90)
        lat_down2, lon_down2 = offset_latlon(lat2, lon2, offset_distance, bearing - 90)
        offset_coords_down.append((lon_down1, lat_down1))
        offset_coords_down.append((lon_down2, lat_down2))

    # オフセットされた座標を使ってポリゴンを作成
    all_coords = offset_coords_up + offset_coords_down[::-1]  # 上のラインと下のラインを結合
    polygon = Polygon(all_coords)

    return polygon