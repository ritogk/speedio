from geopandas import GeoDataFrame, GeoSeries
from pandas import Series
import numpy as np
from shapely.geometry import Point, LineString, MultiLineString
from typing import List, Tuple
from shapely import get_parts
from shapely.ops import nearest_points

# トンネル内の標高を調整する
# 問題: 現状標高は地球表面の形状の値なためトンネル区間の標高値が道の値ではなく山の値になってしまっている。
# また上記の区間はu_shape_elevationも高くなってしまう。
def generate(gdf: GeoDataFrame, tunnel_edges: GeoDataFrame, tif_path: str) -> Series:
    # トンネルの空間インデックスを作成
    tunnel_edges_sindex = tunnel_edges["geometry"].sindex
    def func(row: GeoSeries):
        # tunnelのパターンは大きく分けて2つで'yes'とNan
        if row['tunnel'] != 'yes':
            return row['elevation']
        base_edge_coords = list(row.geometry.coords) 
        # 1. 対象のエッジのバウンディングボックス内のトンネルのインデックスを取得(バウンディングボックスでの抽出なのでエッジ外のトンネルも含まれる可能性がある)
        tunnels_edge_in_bbox_index_list = list(tunnel_edges_sindex.intersection(row.geometry.bounds))
        # 2. インデックスからトンネルのエッジを取得
        tunnels_edges_in_bbox = tunnel_edges.iloc[tunnels_edge_in_bbox_index_list]
        # 3. 対象のエッジと重なるトンネルのみを抽出(一旦座標が2以上重なっているかで判断)
        target_tunnels_index_list = []
        for idx, tunnel_edge in tunnels_edges_in_bbox.iterrows():
            # base_edge_coordsと一致する座標数を取得
            num_match_coords = sum([1 for coord in tunnel_edge.geometry.coords if coord in base_edge_coords])
            if num_match_coords >= 2:
                target_tunnels_index_list.append(idx)
        # 本来ありえないと思うが対象のトンネルがない場合はそのまま返す
        if len(target_tunnels_index_list) == 0:
            print("★ 対象のトンネルがみつかりませんでした。")
            return row['elevation']
        target_tunnels_edges = tunnels_edges_in_bbox.loc[target_tunnels_index_list]

        # for i, tunnel_edge in target_tunnels_edges.iterrows():
        #     coords = list(tunnel_edge.geometry.coords)
        #     # 先頭と末尾の座標を表示
        #     print(f'st: {coords[0]} ed: {coords[-1]}')
        
        # トンネルの始点と終点が線形になるように標高を調整
        elevation_adjusted = row.elevation.copy()
        for i, tunnel_edge in target_tunnels_edges.iterrows():
            tunnel_coords = list(tunnel_edge.geometry.coords)       
            # トンネルの始点と終点に最も近い道のトンネル外の座標を取得
            nearest_outside_start = get_nearest_outside_point(row, tunnel_coords[0], tunnel_coords)
            nearest_outside_end = get_nearest_outside_point(row, tunnel_coords[-1], tunnel_coords)
            a_idx = base_edge_coords.index(nearest_outside_start)
            b_idx = base_edge_coords.index(nearest_outside_end)
            start_idx = min(a_idx, b_idx)
            end_idx = max(a_idx, b_idx)
            def linear_interpolation(arr, start_idx, end_idx) -> List[int]:
                # 開始値と終了値を取得
                start_value = arr[start_idx]
                end_value = arr[end_idx]
                # linspaceで保管する点数を決定
                num_points = end_idx - start_idx + 1
                print(f'start_value: {start_value} end_value: {end_value} num_points: {num_points}')
                interpolated_values = np.linspace(start_value, end_value, num_points)
                # 元の配列に線形補間した値を代入 ★ここでデータが増えちゃってておかしくなってるっぽい。(2024/06/28)
                interpolated_values_list = list(interpolated_values)
                for i, value in enumerate(interpolated_values_list):
                    arr[start_idx + i] = value
                return arr
            print("★★調整したよ")
            # トンネルの始点と終点が線形になるように標高を調整
            # ★ここでデータが増えちゃってておかしくなってるっぽい。(2024/06/28)
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