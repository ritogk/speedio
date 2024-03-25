from geopandas import GeoDataFrame, GeoSeries
from pandas import Series
import pandas as pd
import osmnx as ox
import networkx as nx
from shapely.geometry import Point, LineString
from .core.calculate_angle_between_vectors import calculate_angle_between_vectors

from ..remover import reverse_edge
from geopy.distance import geodesic


def generate(gdf: GeoDataFrame, graph: nx.Graph) -> Series:
    all_nodes, all_edges = ox.graph_to_gdfs(graph, nodes=True, edges=True)

    def func(row):
        turn_points = []
        turn_candidates = row["turn_candidate_points"]
        # print(turn_candidates)
        for turn_candidate in turn_candidates:
            a = turn_candidate["a"]
            b = turn_candidate["b"]
            c = turn_candidate["c"]
            angle_ab_bc = turn_candidate["angle_ab_bc"]
            b_point = Point(b)
            b_node_indexs = all_nodes.sindex.nearest(b_point).tolist()
            # 入れ子のリストをフラットにする
            b_node_indexs = [item for sublist in b_node_indexs for item in sublist]
            b_node_index = b_node_indexs[1:]
            b_node = all_nodes.iloc[b_node_index]

            b_node_id = b_node.index[0]
            node_geometry = b_node.iloc[0].geometry
            distance = geodesic((b[1], b[0]), (node_geometry.y, node_geometry.x)).meters
            # print(f"center_node_id: {b_node_id}")
            # print(f"center_geometry: {node_geometry}")
            # print(f"center_distance: {distance}")

            # 指定座標周辺10m以内にノードがなければ曲がり角ではない。
            if distance > 10:
                # print("指定座標の周辺にノードが存在ませんでした。")
                continue

            # bに連結するエッジを取得
            b_connected_edges = []
            for u, v, k, data in graph.edges(keys=True, data=True):
                if u == b_node_id or v == b_node_id:
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
                # print(b_connected_edge)
                key = b_connected_edge["key"]
                data = b_connected_edge["data"]

                # simplify=Trueの影響でgeometryがない場合があるので簡易的に生成する
                if "geometry" not in data:
                    node = graph.nodes[b_connected_edge["key"][0]]
                    st_node = (node["x"], node["y"])
                    node = graph.nodes[b_connected_edge["key"][1]]
                    ed_node = (node["x"], node["y"])
                    data["geometry"] = LineString([st_node, ed_node])
                    # print(f'create geometry: {data["geometry"]}')

                # aとcにかさならないedgesを抽出
                edge_geometry = data["geometry"]
                if not edge_geometry.intersects(
                    Point(a)
                ) and not edge_geometry.intersects(Point(c)):
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
            print(f"before: {len(gdf_branch_edges)}")
            gdf_branch_edges = reverse_edge.remove(gdf_branch_edges)
            print(f"after: {len(gdf_branch_edges)}")

            # 各エッジのabとbxの角度を計算し、angle_ab_bcより小さい値があればab_bcを曲がり角として登録
            x_angles = []
            for index_, row_ in gdf_branch_edges.iterrows():
                # エッジの座標が2つしかない場合は、bと開始位置が被ってしまうのでいい感じに調整する
                if len(list(row_["geometry"].coords)) < 3:
                    st_point = Point(row_["geometry"].coords[0])
                    ed_point = Point(row_["geometry"].coords[1])
                    if st_point == b_point:
                        nearest_point = ed_point
                    else:
                        nearest_point = st_point
                else:
                    st_point = Point(row_["geometry"].coords[1])
                    ed_point = Point(row_["geometry"].coords[-2])
                    # geometryの頭と尾でbに最も近い点を取得.
                    if b_point.distance(st_point) < b_point.distance(ed_point):
                        nearest_point = st_point
                    else:
                        nearest_point = ed_point
                # print(f"nearest_point: {nearest_point}")
                angle_ab_bx = calculate_angle_between_vectors(
                    a,
                    b,
                    (nearest_point.x, nearest_point.y),
                )

                # print(f"discoved turn point: {b}")
                # print(f"highway: x:{row_['highway']}, base:{row.highway}")
                # print(f"angle_ab_bx: {angle_ab_bx}, angle_ab_bc: {angle_ab_bc}")
                # residentialは薄いので対象外にする。
                if row_["highway"] != "residential":
                    x_angles.append(angle_ab_bx)
                    continue
            # angle_ab_bcが１番小さい値出ない場合は曲がり角として登録
            if len(x_angles) != 0 and min(x_angles) <= angle_ab_bc:
                turn_points.append(b)
        return turn_points

    series = gdf.progress_apply(func, axis=1)
    # series = gdf.apply(func, axis=1)
    return series
