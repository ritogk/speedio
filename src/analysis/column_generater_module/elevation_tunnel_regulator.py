from geopandas import GeoDataFrame, GeoSeries
from pandas import Series
import numpy as np
from shapely.geometry import Point, LineString, MultiLineString
from typing import List, Tuple
from shapely import get_parts

# トンネル内の標高を調整する
# 問題: 現状標高は地球表面の形状の値なためトンネル区間の標高値が道の値ではなく山の値になってしまっている。
# また上記の区間はu_shape_elevationも高くなってしまう。
def generate(gdf: GeoDataFrame, tunnel_edges: GeoDataFrame, tif_path: str) -> Series:
    # gdfの行数を表示
    print(len(gdf))
    # トンネルの空間インデックスを作成
    tunnel_edges_sindex = tunnel_edges["geometry"].sindex
    def func(row: GeoSeries):
        if row['tunnel'] == False:
            return row['elevation']
        # 1. 対象のエッジのバウンディングボックス内のトンネルのインデックスを取得(バウンディングボックスでの抽出なのでエッジ外のトンネルも含まれる可能性がある)
        tunnels_edge_in_bbox_index_list = list(tunnel_edges_sindex.intersection(row.geometry.bounds))
        # 2. インデックスからトンネルのエッジを取得
        tunnels_edges_in_bbox = tunnel_edges.iloc[tunnels_edge_in_bbox_index_list]
        # 3. 対象エッジと交差するトンネルを抽出(ここでは対象エッジの下を通るようなトンネルも含まれてしまう。※1)
        tunnel_edges_intersects = tunnels_edges_in_bbox[tunnels_edges_in_bbox.intersects(row.geometry)]
        # 4. 対象のエッジと重なるトンネルのみを抽出(※1を除外)
        intersecting_lines = tunnel_edges["geometry"].intersection(tunnel_edges_intersects)
        if type(intersecting_lines) != GeoSeries:
            # こんなパターンはないと思うが型を確定させるために追加
            return row['elevation']
        target_index_list = []
        for idx, geom in enumerate(intersecting_lines):
            if isinstance(geom, LineString):
                # 交差するLineStringが1つだけ返ってくる場合は対象の道の下や上を通るトンネルと判定する
                continue
            elif isinstance(geom, MultiLineString):
                # 交差するLineStringが複数返ってくる場合は対象の道に重なるトンネルと判定とする
                target_index_list.append(idx)  

        # 本来ありえないと思うがトンネルがない場合はそのまま返す
        if len(target_index_list) == 0:
            return row['elevation']
        target_tunnels_edges = tunnel_edges.iloc[target_index_list]
        print(target_tunnels_edges)

        # for i, tunnel_edge in target_tunnels_edges.iterrows():
        #     coords = list(tunnel_edge.geometry.coords)
        #     # 先頭と末尾の座標を表示
        #     print(f'st: {coords[0]} ed: {coords[-1]}')
        
        elevation_adjusted = row.elevation.copy()
        for i, tunnel_edge in target_tunnels_edges.iterrows():
            tunnel_coords = list(tunnel_edge.geometry.coords)
            base_edge_coords = list(row.geometry.coords)        
            # トンネルの始点と終点に最も近い道のトンネル外の座標を取得
            nearest_outside_start = get_nearest_outside_point(row, tunnel_coords[0], tunnel_coords)
            nearest_outside_end = get_nearest_outside_point(row, tunnel_coords[-1], tunnel_coords)
            start_idx = base_edge_coords.index(nearest_outside_start)
            end_idx = base_edge_coords.index(nearest_outside_end)
        
            def linear_interpolation(arr, start_idx, end_idx) -> List[int]:
                # 開始値と終了値を取得
                start_value = arr[start_idx]
                end_value = arr[end_idx]

                # linspaceで保管する点数を決定
                if start_idx > end_idx:
                    num_points = start_idx - end_idx + 1
                else:
                    num_points = end_idx - start_idx + 1
                print(f'start_value: {start_value} end_value: {end_value} num_points: {num_points}')
                interpolated_values = np.linspace(start_value, end_value, num_points)
                # 元の配列に線形補間した値を代入
                arr[start_idx:end_idx + 1] = interpolated_values
                return arr
            # print(start_idx)
            # print(end_idx)
            # print(row.elevation)
            # print(linear_interpolation(row.elevation, start_idx, end_idx))

            # トンネルの始点と終点が線形になるように標高を調整
            elevation_adjusted = linear_interpolation(elevation_adjusted, start_idx, end_idx)
        # print(elevation_adjusted)
        return elevation_adjusted

    results = gdf.apply(func, axis=1)
    return results

# トンネル外で最も近い座標を取得
def get_nearest_outside_point(road_edge: GeoSeries, point: Tuple[float, float] , tunnel_coords: list):
    road_coords = list(road_edge.geometry.coords)
    # 単純にベースのエッジ(roadからtunnelの座標をすべて消して、指定のトンネルの座標に最も近い座標を取得すればいいだけ)
    # 1. road_edgeからtunnel_coordsの座標をすべて消す ※1
    road_coords_without_tunnels = [coord for coord in road_coords if not coord in tunnel_coords]
    # 2. ※1から指定座標(point)に最も近い座標を取得 ※3
    nearest_point = min(road_coords_without_tunnels, key=lambda x: Point(x).distance(Point(point)))
    # 3. ※3を返す
    return nearest_point