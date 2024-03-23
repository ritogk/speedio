from geopandas import GeoDataFrame
from pandas import Series
import pandas as pd
import osmnx as ox
import numpy as np
import networkx as nx
from shapely.geometry import Point, LineString
from .core.calculate_angle_between_vectors import calculate_angle_between_vectors

from ..remover import reverse_edge


def generate(gdf: GeoDataFrame, graph: nx.Graph):
    pass
    # gdf["geometry"]でループ
    for index, row in gdf.iterrows():
        for j in range(1, len(row.geometry.coords) - 1):
            a = row.geometry.coords[j - 1]
            b = row.geometry.coords[j]
            c = row.geometry.coords[j + 1]
            highway = row.highway
            angle_ab_bc = calculate_angle_between_vectors(
                a,
                b,
                c,
            )
            if angle_ab_bc > 80:
                print("★曲がり角の候補")
                print(f"center_point: {b[0]}, {b[1]}")
                node_id, distance = ox.nearest_nodes(graph, b[0], b[1], True)

                # ノードIDと距離がリストで返された場合、最小距離のものを選択
                if isinstance(distance, list):
                    min_distance = min(distance)
                    min_index = distance.index(min_distance)
                    min_node_id = node_id[min_index]
                else:
                    min_node_id = node_id
                    min_distance = distance
                # print(f"center_node_id: {min_node_id}")
                # print(f"center_distance: {min_distance}")

                # 指定座標周辺にノードがなければ曲がり角ではない。
                if min_distance < 10:
                    print("周辺にノードが存在しない。")
                    pass

                # bに連結するエッジを取得
                b_connected_edges = []
                for u, v, k, data in graph.edges(keys=True, data=True):
                    if u == node_id or v == node_id:
                        b_connected_edges.append(
                            {
                                "key": (u, v, k),
                                "data": data,
                            }
                        )

                # エッジからabとbcを除いてdataframe用のリストを作成
                b_connected_edge_keys = []
                b_connected_edge_values = []
                for b_connected_edge in b_connected_edges:
                    key = b_connected_edge["key"]
                    data = b_connected_edge["data"]
                    # aとcにかさならないedgesを抽出
                    edge_geometry = data["geometry"]
                    if not edge_geometry.intersects(
                        Point(a)
                    ) and not edge_geometry.intersects(Point(c)):
                        print("★こいつが分岐した道")
                        print(edge_geometry)
                        b_connected_edge_keys.append(b_connected_edge["key"])
                        b_connected_edge_values.append(
                            [key[0], key[1], data["geometry"], data["highway"]]
                        )
                # データフレームを作成
                multi_index = pd.MultiIndex.from_tuples(
                    b_connected_edge_keys, names=["u", "v", "k"]
                )
                gdf_branch_edges = pd.DataFrame(
                    b_connected_edge_values,
                    index=multi_index,
                    columns=["start_node", "end_node", "geometry", "highway"],
                )
                # 逆方向のエッジを削除
                # print(f"before: {len(gdf_branch_edges)}")
                gdf_branch_edges = reverse_edge.remove(gdf_branch_edges)
                # print(f"after: {len(gdf_branch_edges)}")
                # print(gdf_branch_edges)

                # 各エッジのabとbxの角度を計算し、angle_ab_bcより小さい値があればab_bcを曲がり角として登録
                for index_, row_ in gdf_branch_edges.iterrows():
                    # geometryの頭と尾でbに最も近い点を取得
                    st_point = Point(row_["geometry"].coords[1])
                    ed_point = Point(row_["geometry"].coords[-1])
                    if Point(a).distance(st_point) < Point(a).distance(ed_point):
                        nearest_point = st_point
                    else:
                        nearest_point = ed_point
                    # print(f"nearest_point: {nearest_point}")
                    angle_ab_bx = calculate_angle_between_vectors(
                        a,
                        b,
                        (nearest_point.x, nearest_point.y),
                    )
                    # print("★★★★★★★")
                    # print(f"angle_ab_bx: {angle_ab_bx}, angle_ab_bc: {angle_ab_bc}")
                    # print(f"highway: x:{row_['highway']}, base:{highway}")
                    # angle_ab_bcの角度より大きい、かつhighwayが同じ場合は、曲がり角ではない判定。
                    if angle_ab_bc < angle_ab_bx and row_["highway"] == highway:
                        print(row_)
                        pass
