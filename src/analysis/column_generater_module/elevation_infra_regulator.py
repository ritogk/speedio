from geopandas import GeoDataFrame, GeoSeries
from pandas import Series
import numpy as np
from shapely.geometry import Point
from typing import List, Tuple
from enum import Enum

class InfraType(Enum):
    TUNNEL = 1
    BRIDGE = 2

# トンネルや橋の標高を調整する
# 問題: 現状標高は地球表面の形状の値なためトンネル区間の標高値が道の値ではなく山の値になってしまっている。
# また上記の区間はu_shape_elevationも高くなってしまう。
def generate(gdf: GeoDataFrame, infra_edges: GeoDataFrame, infraType: InfraType) -> Series:
    # トンネルの空間インデックスを作成
    infra_edges_sindex = infra_edges["geometry"].sindex
    def func(row: GeoSeries):
        if (infraType == InfraType.BRIDGE and row['bridge'] != 'yes') or (infraType == InfraType.TUNNEL and row['tunnel'] != 'yes'):
            return row['elevation']
        base_edge_coords = list(row.geometry.coords) 
        # 1. 対象のエッジのバウンディングボックス内のトンネルのインデックスを取得(バウンディングボックスでの抽出なのでエッジ外のトンネルも含まれる可能性がある)
        infra_edge_in_bbox_index_list = list(infra_edges_sindex.intersection(row.geometry.bounds))
        # 2. インデックスからトンネルのエッジを取得
        infra_edges_in_bbox = infra_edges.iloc[infra_edge_in_bbox_index_list]
        # 3. 対象のエッジと重なるトンネルのみを抽出(一旦座標が2以上重なっているかで判断)
        target_infra_index_list = []
        for idx, infra_edge in infra_edges_in_bbox.iterrows():
            # base_edge_coordsと一致する座標数を取得
            num_match_coords = sum([1 for coord in infra_edge.geometry.coords if coord in base_edge_coords])
            if num_match_coords >= 2:
                target_infra_index_list.append(idx)
        if len(target_infra_index_list) == 0:
            # print("★ 対象のトンネルなし。多分対象のエッジ外のトンネルしかない状態だと思う。")
            return row['elevation']
        target_infra_edges = infra_edges_in_bbox.loc[target_infra_index_list]

        for i, infra_edge in target_infra_edges.iterrows():
            coords = list(infra_edge.geometry.coords)
            # # 先頭と末尾の座標を表示
            # print(f'st: {coords[0]} ed: {coords[-1]}')
        
        # トンネルの始点と終点が線形になるように標高を調整
        elevation_adjusted = row.elevation.copy()
        for i, infra_edge in target_infra_edges.iterrows():
            infra_coords = list(infra_edge.geometry.coords)       
            # トンネルの始点と終点に最も近い道のトンネル外の座標を取得
            road_coords = list(row.geometry.coords)
            if(road_coords != infra_coords):
                # 通常パターン
                nearest_outside_start = get_nearest_outside_point(road_coords, infra_coords[0], infra_coords)
                nearest_outside_end = get_nearest_outside_point(road_coords, infra_coords[-1], infra_coords)
            else:
                # あんまりないパターン。
                # ベースのエッジとトンネルのエッジが一致している場合は始点と終点を設定(例: 135.2008906, 34.6844095))
                # 開始座標と終了座標をのこすようにしたからこの処理は不要になるかも？
                print('★ベースのエッジとトンネルのエッジが一致')
                nearest_outside_start = road_coords[0]
                nearest_outside_end = road_coords[-1]
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
                # print(f'start_value: {start_value} end_value: {end_value} num_points: {num_points}')
                interpolated_values = np.linspace(start_value, end_value, num_points)
                # 元の配列に線形補間した値を代入 ★ここでデータが増えちゃってておかしくなってるっぽい。(2024/06/28)
                interpolated_values_list = list(interpolated_values)
                for i, value in enumerate(interpolated_values_list):
                    arr[start_idx + i] = value
                return arr
            # トンネルの始点と終点が線形になるように標高を調整
            elevation_adjusted = linear_interpolation(elevation_adjusted, start_idx, end_idx)
        return elevation_adjusted

    results = gdf.apply(func, axis=1)
    return results

# トンネル外で最も近い座標を取得
def get_nearest_outside_point(road_coords: list, point: Tuple[float, float] , infra_coords: list):
    # 単純にベースのエッジ(roadからinfraの座標をすべて消して、指定のトンネルの座標に最も近い座標を取得すればいいだけ)
    # 1. road_edgeからinfra_coordsの座標をすべて消す ※1
    # 先頭と末尾の座標は保持しておかないとインフラの座標が先頭と末尾の座標に含まれる時にnear_pointが計算できなくなる。例: (34.76489640673564, 135.15251373171773)
    road_coords_without_infras = [road_coords[0]]  # 先頭を保持
    road_coords_without_infras += [coord for coord in road_coords[1:-1] if not coord in infra_coords]  # 中間のデータをフィルタリング
    road_coords_without_infras.append(road_coords[-1])  # 末尾を保持
    # 2. ※1から指定座標(point)に最も近い座標を取得 ※3
    nearest_point = min(road_coords_without_infras, key=lambda x: Point(x).distance(Point(point)))
    return nearest_point