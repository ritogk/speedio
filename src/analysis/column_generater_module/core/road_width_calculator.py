import geopandas as gpd
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import warnings
from shapely.geometry import Point, LineString
import time
from pyproj import Transformer
from shapely.ops import nearest_points
import glob
from rtree import Rtree
import pickle
import os
from shapely.geometry import MultiPoint

warnings.simplefilter(action="ignore", category=FutureWarning)


class RoadWidthCalculator:
    road_center_s: gpd.GeoSeries
    road_center_i: Rtree
    road_edge_s: gpd.GeoSeries
    road_edge_i: Rtree

    def __init__(self, center_path: str, edge_path: str):
        file_list = glob.glob(f"{center_path}/*.geojson")
        path = f"{os.path.dirname(os.path.abspath(__file__))}/center_gdf"
        # print(path)
        if os.path.exists(path):
            print("load center_gdf")
            with open(path, "rb") as f:
                road_center_df = pickle.load(f)
        else:
            print("create center_gdf")
            gdf_list = [gpd.read_file(file) for file in file_list]
            road_center_df = gpd.GeoDataFrame(
                pd.concat(gdf_list, ignore_index=True)
            ).to_crs("EPSG:6677")
            # 保存する
            with open(path, "wb") as f:
                pickle.dump(road_center_df, f)
        self.road_center_s = road_center_df["geometry"]
        self.road_center_i = self.road_center_s.sindex

        file_list = glob.glob(f"{edge_path}/*.xml")
        # print(file_list)
        path = f"{os.path.dirname(os.path.abspath(__file__))}/edge_gdf"
        if os.path.exists(path):
            print("load edge_gdf")
            with open(path, "rb") as f:
                road_edge_df = pickle.load(f)
        else:
            print("create edge_gdf")
            gdf_list = [gpd.read_file(file) for file in file_list]
            road_edge_df = gpd.GeoDataFrame(
                pd.concat(gdf_list, ignore_index=True)
            ).to_crs("EPSG:6677")
            # 保存する
            with open(path, "wb") as f:
                pickle.dump(road_edge_df, f)
        self.road_edge_s = road_edge_df["geometry"]
        self.road_edge_i = self.road_edge_s.sindex
        print("end")

    def _to_latlon(self, x, y):
        tr = Transformer.from_proj(6677, 6668)
        lat, lon = tr.transform(y, x)
        return lon, lat

    def _to_xy(self, lon, lat):
        tr = Transformer.from_proj(6668, 6677)
        y, x = tr.transform(lat, lon)
        return x, y

    # 1. 指定座標に最も近い中央線を探す
    def _search_nearest_center_line(self, point: Point) -> LineString | None:
        # 空間インデックスを使用して最も近いLiのindexをneStringを取得する。
        indexs = self.road_center_i.nearest(point, max_distance=100)
        # なぜか先頭にindex番号0が含まれているので消す。
        index = indexs[1:]
        if index.size != 0:
            line = self.road_center_s.iloc[index[0][0]]
            return line
        return None

    # 3. LineStringに垂直な法線を作成する
    def _create_normal_line(self, line: LineString, length: int) -> LineString | None:
        p1 = line.coords[0]
        p2 = line.coords[1]
        # p1とp2が同じ場合がある。なぜ？
        # p1: (-581523.5580293104, -122131.76981817895)
        # p2: (-581523.5580293104, -122131.76981817895)
        if p1 == p2:
            return None
        # 法線ベクトルを求める
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        len = np.sqrt(dx * dx + dy * dy)
        # print("len: " + str(len), " dx: " + str(dx), " dy: " + str(dy))
        # len: 0.0  dx: 0.0  dy: 0.0
        normal = np.array([-dy, dx]) / len
        # 垂直な法線を指定の長さに伸ばす(m)
        p2 = np.array(p2)
        p_normal = p2 + normal * length
        normal_line = LineString([p2, p_normal])
        return normal_line

    def calculate(self, st_coord: Point, ed_coord: Point) -> int | None:
        time_st = time.time()

        st_x, st_y = self._to_xy(st_coord.x, st_coord.y)
        ed_x, ed_y = self._to_xy(ed_coord.x, ed_coord.y)
        points = [Point(st_x, st_y), Point(ed_x, ed_y)]

        # 1. 指定座標に最も近い中央線を探す
        nearest_center_line = self._search_nearest_center_line(points[0])
        if nearest_center_line is None:
            print("nearest_center_line is None")
            return None

        # 2. 1で抽出した中央線上で最も近い座標を含んだlineStringを作成する
        nearest_line = LineString(
            [
                nearest_points(nearest_center_line, points[0])[0],
                nearest_points(nearest_center_line, points[1])[0],
            ]
        )

        # 3. 2のLineStringから法線を作成する
        normal_line = self._create_normal_line(nearest_line, 10)
        if normal_line is None:
            print("normal_line is None")
            return None

        # 以下の処理が衝突ではなく、linestringの周辺の点を取得してしまっている。

        width_lines = []
        # 法線に衝突する道幅線を探す
        # 複数のエッジが返ってくる場合があるので最も近いものを選ぶ
        collision_edge_index_list = self.road_edge_i.intersection(normal_line.bounds)
        for idx in collision_edge_index_list:
            collision_edge = self.road_edge_s[idx]
            # 道幅線と法線の衝突点を求める
            collision_point = normal_line.intersection(collision_edge)
            if collision_point:
                # ん？そもそもなんでMultiPointになるの？法線と1道幅線の交点は1点のはずなのに。
                if isinstance(collision_point, MultiPoint):
                    print("要調査")
                    collision_point = gpd.GeoSeries([collision_point]).explode().iloc[0]
                # print(collision_p/oint)
                src = Point(nearest_line.coords[1])
                dst = collision_point
                dx = dst.x - src.x
                dy = dst.y - src.y
                distance = np.sqrt(dx * dx + dy * dy)
                width_lines.append(
                    {
                        "line": LineString(
                            [
                                Point(self._to_latlon(src.x, src.y)),
                                Point(self._to_latlon(dst.x, dst.y)),
                            ]
                        ),
                        "distance": distance,
                        "base_line": LineString(
                            [
                                Point(
                                    self._to_latlon(
                                        nearest_line[0].x, nearest_line[0].y
                                    )
                                ),
                                Point(
                                    self._to_latlon(
                                        nearest_line[1].x, nearest_line[1].y
                                    )
                                ),
                            ]
                        ),
                    }
                )

        # width_linesを距離が大きい順にソート
        width_lines = sorted(width_lines, key=lambda x: x["distance"], reverse=True)

        if not width_lines:
            return None
        return width_lines[0]
