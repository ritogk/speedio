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
import glob
from rtree import Rtree

warnings.simplefilter(action="ignore", category=FutureWarning)


class RoadWidthCalculator:
    road_center_s: gpd.GeoSeries
    road_center_i: Rtree
    road_edge_s: gpd.GeoSeries
    road_edge_i: Rtree

    def __init__(self, center_path: str, edge_path: str):
        file_list = glob.glob(f"{center_path}/*.geojson")
        gdf_list = [gpd.read_file(file) for file in file_list]
        road_center_df = gpd.GeoDataFrame(
            pd.concat(gdf_list, ignore_index=True)
        ).to_crs("EPSG:6677")
        self.road_center_s = road_center_df["geometry"]
        self.road_center_i = self.road_center_s.sindex

        # file_list = glob.glob(f"{edge_path}/*.xml")
        file_list = glob.glob(f"{edge_path}/*.geojson")
        gdf_list = [gpd.read_file(file) for file in file_list]
        road_edge_df = gpd.GeoDataFrame(pd.concat(gdf_list, ignore_index=True)).to_crs(
            "EPSG:6677"
        )
        self.road_edge_s = road_edge_df["geometry"]
        self.road_edge_i = self.road_edge_s.sindex

    def _to_latlon(self, x, y):
        tr = Transformer.from_proj(6677, 6668)
        lat, lon = tr.transform(x, y)
        return lat, lon

    def _to_xy(self, lat, lon):
        tr = Transformer.from_proj(6668, 6677)
        x, y = tr.transform(lat, lon)
        return x, y

    def calculate(self, st_coord: Point, ed_coord: Point) -> int:
        time_st = time.time()
        st_x, st_y = self._to_xy(st_coord.x, ed_coord.y)
        ed_x, ed_y = self._to_xy(ed_coord.x, ed_coord.y)
        points = [Point(st_y, st_x), Point(ed_y, ed_x)]

        nearest_lines = []
        area = []
        for point in points:
            # 空間インデックスを使用して最も近いLiのindexをneStringを取得
            # 星以下でエラーがでる
            indexs = self.road_center_i.nearest(point, max_distance=100)
            # なぜか先頭にindex番号0が含まれているので消す。
            index = indexs[1:]
            line = self.road_center_s.iloc[index[0][0]]
            a = nearest_points(line, point)
            syototu_point = a[0]
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
            possible_collisions = self.road_edge_i.intersection(normal_line.bounds)
            for idx in possible_collisions:
                road_edge = self.road_edge_s[idx]
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
                    # print(nearest_distance)
                    # print(to_latlon(nearest_collision_point.y, nearest_collision_point.x))
                    syototu_lines.append(
                        {
                            "line_string": LineString([src, dst]),
                            "distance": nearest_distance * 2,
                        }
                    )
            normals.append(LineString([p2, p_normal]))
        # print(syototu_lines)
        print(f"time: {time.time() - time_st}")

        return syototu_lines[0]["distance"]
