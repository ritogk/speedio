from shapely.geometry import Polygon
import math
from geopy.distance import geodesic

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

# linestringから垂直にオフセットしたポリゴンを作成
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