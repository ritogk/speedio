import geopandas as gpd
import shapely
import pandas as pd
import numpy as np
import math
import matplotlib.pyplot as plt
import warnings
from shapely.geometry import Point, LineString
import time
from pyproj import Transformer
from shapely.ops import nearest_points

warnings.simplefilter(action="ignore", category=FutureWarning)

time_st = time.time()


def to_latlon(x, y):
    tr = Transformer.from_proj(6677, 6668)
    lat, lon = tr.transform(x, y)
    return lat, lon


def to_xy(lat, lon):
    tr = Transformer.from_proj(6668, 6677)
    x, y = tr.transform(lat, lon)
    return x, y


# 座標系を緯度経度から平面直角座標系に変換
road_center = gpd.read_file("./combined_json.geojson")
road_center = road_center.to_crs("EPSG:6677")
road_edge = gpd.read_file("../roadEdge_clipped.geojson")
road_edge_proj = road_edge.to_crs("EPSG:6677")
road_edges = road_edge_proj["geometry"]
rode_edges_index = road_edges.sindex
# road_centerからgeometryのみを取り出す
lines = road_center["geometry"]

edges = [
    [(35.6938077, 139.7628514), (35.6937878, 139.7629656)],
    [(35.6937779, 139.7630426), (35.6937729, 139.7631321)],
    [(35.6937506, 139.7632687), (35.6937506, 139.7633904)],
    [(35.6937282, 139.7635320), (35.6937083, 139.7637705)],
]
# edgesの座標をtransformする
for i in range(len(edges)):
    for j in range(len(edges[i])):
        x, y = to_xy(edges[i][j][0], edges[i][j][1])
        edges[i][j] = Point(y, x)

## closest_line = min(lines, key=lambda line: line.distance(point))

# 空間インデックスを作成する
# 空間インデックスの作成には時間がかかるが、一度作成しておけば何度でも高速に探索できる。
# んじゃあ、空間インデックスを含む固定値を保存しておいたほうがいいかも。
geo_index = road_center.sindex
print(time.time() - time_st)
nearest_lines = []
for edge in edges:
    area = []
    for point in edge:
        # 空間インデックスを使用して最も近いLineStringを取得
        a = geo_index.nearest(point, max_distance=100)

        # なぜか先頭にindex番号0が含まれているので消す。
        a = a[1:]
        line = lines.iloc[a[0][0]]
        syototu_point = nearest_points(line, point)[0]
        area.append(syototu_point)
    nearest_lines.append(LineString(area))

syototu_lines = []
normals = []
edfes_length = []
for line in nearest_lines:
    # lineの0と1の点を取り出す
    p1 = line.coords[0]
    p2 = line.coords[1]
    # 法線ベクトルを求める
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    len = np.sqrt(dx * dx + dy * dy)
    normal = np.array([-dy, dx]) / len
    normal_length = 20
    # 法線ベクトルを使って線分を伸ばす
    p2 = np.array(p2)
    p_normal = p2 + normal * normal_length

    # ★★★★★★★p_normalと衝突するroad_edgeで最も近い点を求める。見つからない場合はnanを返す。
    normal_line = LineString([p2, p_normal])
    # 以下の処理が衝突ではなく、linestringの周辺の点を取得してしまっている。
    possible_collisions = rode_edges_index.intersection(normal_line.bounds)
    for idx in possible_collisions:
        road_edge = road_edges[idx]
        if normal_line.intersects(road_edge):
            collision_point = normal_line.intersection(road_edge)
            # print(normal_line[0].xy)
            src = Point(p2)
            dst = collision_point
            dx = dst.x - src.x
            dy = dst.y - src.y
            distance = np.sqrt(dx * dx + dy * dy)

            nearest_distance = distance
            nearest_collision_point = collision_point
            print(nearest_distance)
            print(to_latlon(nearest_collision_point.y, nearest_collision_point.x))
            syototu_lines.append(LineString([src, dst]))

    # print(f"syototu_edge: ${syototu}")

    # 空間インデックスを使用して最も近いLineStringを取得

    # なぜか先頭にindex番号0が含まれているので消す。
    # a = a[1:]
    # line = lines.iloc[a[0][0]]
    # syototu_point = nearest_points(line, point)[0]
    # 衝突するまでの距離を二倍にする
    normals.append(LineString([p2, p_normal]))

# nearest_areaのを描画
fig, ax = plt.subplots(figsize=(11, 11))
for line in lines:
    ax.plot(*line.xy, color="blue", linewidth=1)
for line in nearest_lines:
    ax.plot(*line.xy, color="red", linewidth=1)
for normal in normals:
    ax.plot(*normal.xy, color="green", linewidth=1)
for edge in road_edge_proj["geometry"]:
    ax.plot(*edge.xy, color="black", linewidth=1)
for edge in syototu_lines:
    ax.plot(*edge.xy, color="orangered", linewidth=1)
# ax.plot(*road_edge_proj["geometry"][26].xy, color="orangered", linewidth=1)
# ax.plot(road_edge_proj["geometry"][81], color="orangered", linewidth=1)
# ax.plot(road_edge_proj["geometry"][81], color="orangered", linewidth=1)
ax.legend()
plt.show()
