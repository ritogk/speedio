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
            print("  load center_gdf")
            with open(path, "rb") as f:
                road_center_df = pickle.load(f)
        else:
            print("  create center_gdf")
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
            print("  load edge_gdf")
            with open(path, "rb") as f:
                road_edge_df = pickle.load(f)
        else:
            print("  create edge_gdf")
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
    def _create_normal_line(
        self, line: LineString, length: int
    ) -> tuple[LineString, LineString] | None:
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

        # 逆方向の法線
        p_normal_reverse = p2 - normal * length
        normal_line_reverse = LineString([p2, p_normal_reverse])

        if normal_line is None or normal_line_reverse is None:
            return None

        return normal_line, normal_line_reverse

    # 法線を道幅に収める形にする
    def _create_width_line(self, normal_line: LineString) -> LineString | None:
        width_lines = []
        # 法線に衝突する道幅線を探す
        # 空間インデックス使用して近くのラインを取得している。
        # そのため、複数の値が返ってくることがある。
        collision_edge_index_list = self.road_edge_i.intersection(normal_line.bounds)
        min_distance = 100000000
        collision_edge: LineString | None = None
        for index in collision_edge_index_list:
            edge = self.road_edge_s[index]
            distance = normal_line.distance(edge)
            if distance < min_distance:
                min_distance = distance
                collision_edge = edge

        # 道幅線と法線の衝突点を求める
        collision_point = normal_line.intersection(collision_edge)
        if collision_point is None:
            return None
        if collision_point.is_empty:
            return None
        # 道幅線は直線とは限らない(V字型の道路など)ので、複数の衝突点が返ってくる場合がある。
        # その場合は法線の始点に最も近い点を選ぶ。
        if isinstance(collision_point, MultiPoint):
            collision_point = min(
                collision_point.geoms,
                key=lambda point: point.distance(Point(normal_line.coords[0])),
            )
        assert isinstance(collision_point, Point)
        # ★これ大丈夫?
        src = Point(normal_line.coords[0])
        dst = collision_point
        dx = dst.x - src.x
        dy = dst.y - src.y
        distance = np.sqrt(dx * dx + dy * dy)

        return {
            "line": LineString(
                [
                    Point(self._to_latlon(src.x, src.y)),
                    Point(self._to_latlon(dst.x, dst.y)),
                ]
            ),
            "distance": distance,
        }

    def calculate(self, st_coord: Point, ed_coord: Point) -> tuple | None:
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
        normal_result = self._create_normal_line(nearest_line, 15)
        if normal_result is None:
            print("normal_line or normal_line_opposite is None")
            return None
        normal_line = normal_result[0]
        normal_line_opposite = normal_result[1]

        # 4. 3の法線を道幅に収まる形にする
        width_line = self._create_width_line(normal_line)
        width_opposite_line = self._create_width_line(normal_line_opposite)
        if width_line is None or width_opposite_line is None:
            print("width_line or width_opposite_line is None")
            return None
        return width_line, width_opposite_line
