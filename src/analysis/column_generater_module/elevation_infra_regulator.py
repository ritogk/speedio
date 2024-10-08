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
# そのまんま標高値を使うと標高値は地球表面の形状の値なため調整する
def generate(gdf: GeoDataFrame, infra_edges: GeoDataFrame, infraType: InfraType) -> Series:
    # トンネルの空間インデックスを作成
    infra_edges_sindex = infra_edges["geometry"].sindex
    def func(row: GeoSeries):
        # row['bridge']とrow['tunnel']は配列と文字列の２パターンあり。
        if (
            infraType == InfraType.BRIDGE
            and not any(x in row['bridge'] for x in ['yes', 'aqueduct', 'boardwalk', 'cantilever', 'covered', 'low_water_crossing', 'movable', 'trestle', 'viaduct'])
        ):
            return row['elevation']
        if(
            infraType == InfraType.TUNNEL
            and not any(x in row['tunnel'] for x in ['yes', 'building_passage', 'avalanche_protector', 'culvert', 'canal', 'flooded'])
        ):
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
            nearest_outside_start = get_nearest_outside_point(road_coords, infra_coords[0], infra_coords)
            nearest_outside_end = get_nearest_outside_point(road_coords, infra_coords[-1], infra_coords)
            a_idx = base_edge_coords.index(nearest_outside_start)
            b_idx = base_edge_coords.index(nearest_outside_end)
            start_idx = min(a_idx, b_idx)
            end_idx = max(a_idx, b_idx)
            # print(nearest_outside_start)
            # print(nearest_outside_end)
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
# 単純にベースのエッジからinfra座標(先頭と末尾を消したもの)をすべて消して、指定のトンネルの座標に最も近い座標を取得するだけ。
def get_nearest_outside_point(road_coords: list, point: Tuple[float, float] , infra_coords: list):

    if road_coords == infra_coords:
        # インフラとエッジが一致している場合の処理
        return min(road_coords, key=lambda x: Point(x).distance(Point(point)))    
    road_coords_without_infras = []
    # インフラの先頭と末尾を削除。
    infra_coords_without_first_and_last = infra_coords[1:-1]
    if not len(infra_coords_without_first_and_last) == 0:
        # ベースエッジからinfraの中間座標を削除
        road_coords_without_infras += [coord for coord in road_coords if not coord in infra_coords_without_first_and_last]  # 中間のデータをフィルタリング
    else:
        # インフラが２座標の場合は消す座標がないのでそのまま代入
        road_coords_without_infras = road_coords
    # 指定座標(point)に最も近い座標を取得
    nearest_point = min(road_coords_without_infras, key=lambda x: Point(x).distance(Point(point)))
    if nearest_point == (135.1666045, 34.699294):
        pass
    return nearest_point