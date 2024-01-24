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
nearest_area = []
for edge in edges:
    area = []
    for point in edge:
        # 空間インデックスを使用して最も近いLineStringを取得
        a = geo_index.nearest(point, max_distance=100)
        # print(f"x: {point.x} y: {point.y} index: {a[1:]}")

        # なぜか先頭にindex番号0が含まれているので消す。
        a = a[1:]
        line = lines.iloc[a[0][0]]
        syototu_point = nearest_points(line, point)[0]
        area.append(syototu_point)
    nearest_area.append(LineString(area))

# nearest_areaのを描画
fig, ax = plt.subplots()
for line in lines:
    ax.plot(*line.xy, color="blue", linewidth=1)
for area in nearest_area:
    ax.plot(*area.xy, color="red", linewidth=3)
ax.legend()
plt.show()


# for i in a:
#     # print(i)
#     # indexからgeometryを取り出す
#     nearest.append(lines.iloc[i[0]])

# # 最も近いLineStringから最も近い点を取り出す
# syototu_point = nearest_points(nearest[0], point)[0]
# tr = Transformer.from_proj(6677, 6668)
# x, y = tr.transform(syototu_point.y, syototu_point.x)

# print(time.time() - time_st)

# # 候補を描画
# fig, ax = plt.subplots()
# for line in lines:
#     ax.plot(*line.xy, color="blue", linewidth=1)
# for line in nearest:
#     ax.plot(*line.xy, color="red", linewidth=3)
# ax.plot(*point.xy, "go", label="Point")
# ax.legend()
# plt.show()


# nearest_lines = road_center.iloc[nearest_index]

# # 空間インデックスを使用して候補となるLineStringを取得
# possible_matches_index = list(road_center.sindex.nearest(point))
# possible_matches = road_center.iloc[possible_matches_index]

# # 最も近いLineStringを見つける
# closest_line = possible_matches.geometry.distance(point).idxmin()


# # Matplotlibを使用してLineStringsと点をプロット
# fig, ax = plt.subplots()

# # 全てのLineStringsをプロット（最も近いもの以外は青色）
# for line in lines:
#     if line == closest_line:
#         ax.plot(*line.xy, color="red", linewidth=3, label="Closest LineString")
#     else:
#         ax.plot(*line.xy, color="blue", linewidth=1)

# # 座標点をプロット
# ax.plot(*point.xy, "go", label="Point")

# # ラベルと凡例の追加
# ax.legend()
# plt.show()
