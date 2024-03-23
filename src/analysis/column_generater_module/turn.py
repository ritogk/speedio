from geopandas import GeoDataFrame
from pandas import Series
import pandas as pd
import osmnx as ox
import networkx as nx
from shapely.geometry import Point, LineString
from .core.calculate_angle_between_vectors import calculate_angle_between_vectors

from ..remover import reverse_edge


def generate(gdf: GeoDataFrame, graph: nx.Graph) -> Series:
    def func(row):
        turn_points = []
        turn_candidates = row["turn_candidate_points"]
        # print(turn_candidates)
        for turn_candidate in turn_candidates:
            a = turn_candidate["a"]
            b = turn_candidate["b"]
            c = turn_candidate["c"]
            angle_ab_bc = turn_candidate["angle_ab_bc"]
            # ここで時間食ってそう。高速化できないか？
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

            # 指定座標周辺10m以内にノードがなければ曲がり角ではない。
            if min_distance > 10:
                # print("周辺にノードが存在しない。")
                continue

            # bに連結するエッジを取得
            b_connected_edges = []
            for u, v, k, data in graph.edges(keys=True, data=True):
                if u == min_node_id or v == min_node_id:
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
            # print(f"before: {len(gdf_branch_edges)}")
            gdf_branch_edges = reverse_edge.remove(gdf_branch_edges)
            # print(f"after: {len(gdf_branch_edges)}")
            # print(gdf_branch_edges)

            # 各エッジのabとbxの角度を計算し、angle_ab_bcより小さい値があればab_bcを曲がり角として登録
            for index_, row_ in gdf_branch_edges.iterrows():
                # geometryの頭と尾でbに最も近い点を取得
                st_point = Point(row_["geometry"].coords[1])
                ed_point = Point(row_["geometry"].coords[-2])
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

                # angle_ab_bcの方が角度大きい場合は曲がり角として登録
                # residentialは薄いので対象外にする。
                if angle_ab_bc > angle_ab_bx and row_["highway"] != "residential":
                    # print(row_)
                    # print("曲がり角発見!")
                    print(f"discoved turn point: {b}")
                    print(f"highway: x:{row_['highway']}, base:{row.highway}")
                    print(f"angle_ab_bx: {angle_ab_bx}, angle_ab_bc: {angle_ab_bc}")
                    turn_points.append(b)
                    break
        return turn_points

    series = gdf.apply(func, axis=1)
    return series
