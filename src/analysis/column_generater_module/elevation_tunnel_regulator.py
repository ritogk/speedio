from geopandas import GeoDataFrame, GeoSeries
from pandas import Series
import numpy as np
from shapely.geometry import Point, LineString, MultiLineString
from typing import List
from shapely import get_parts

# トンネル内の標高を調整する
# 問題: 現状標高は地球表面の形状の値なためトンネル区間の標高値が道の値ではなく山の値になってしまっている。
# また上記の区間はu_shape_elevationも高くなってしまう。
def generate(gdf: GeoDataFrame, tunnel_edges: GeoDataFrame, tif_path: str) -> Series:
    # gdfの行数を表示
    print(len(gdf))
    # トンネルの空間インデックスを作成
    tunnel_edges_sindex = tunnel_edges["geometry"].sindex
    # return gdf['elevation']
    def func(row):
        if row['tunnel'] == False:
            return row['elevation']
        # 1. 対象のエッジのバウンディングボックス内のトンネルのインデックスを取得(バウンディングボックスでの抽出なのでエッジ外のトンネルも含まれる可能性がある)
        tunnels_edge_in_bbox_index_list = list(tunnel_edges_sindex.intersection(row.geometry.bounds))
        # 2. インデックスからトンネルのエッジを取得
        tunnels_edges_in_bbox = tunnel_edges.iloc[tunnels_edge_in_bbox_index_list]
        # 3. 対象エッジと交差するトンネルのみと抽出
        tunnel_edges_intersects = tunnels_edges_in_bbox[tunnels_edges_in_bbox.intersects(row.geometry)]
        # 4. 対象のエッジと交差するラインストリングを取得して座標が2つ以上あるものを取得
        intersecting_lines = tunnel_edges["geometry"].intersection(tunnel_edges_intersects)
        if type(intersecting_lines) != GeoSeries:
            # こんなパターンはないと思うが形を確定させるために追加
            return row['elevation']
        print('★★★★★')
        print(intersecting_lines)

        # intersecting_linesをintersecting_lines

        target_index_list = []
        cnt = 1
        for idx, geom in enumerate(intersecting_lines):
            coordinates = []
            if isinstance(geom, LineString):
                # 交差するLineStringが1つだけ返ってくる場合は対象の道の下や上を通るトンネルと判定する
                coordinates.extend(list(geom.coords))
            elif isinstance(geom, MultiLineString):
                # 交差するLineStringが複数返ってくる場合は対象の道に重なるトンネルと判定とする
                coords = [
                    list(ln.coords) 
                    for ln in get_parts(geom)
                ]
                coordinates.extend(coords)
                target_index_list.append(idx)  
            print(target_index_list)
        target_tunnles_edges = tunnel_edges.iloc[target_index_list]
        print(target_tunnles_edges)

        # target_tunnles_edgesをループ
        for i, tunnel_edge in target_tunnles_edges.iterrows():
            coords = list(tunnel_edge.geometry.coords)
            # 先頭と末尾の座標を表示
            print(f'st: {coords[0]} ed: {coords[-1]}')
        
        # トンネル外で最も近い座標を取得
        def get_nearest_outside_point(road, point, tunnel_bbox):
            # bounding box外の座標を取得
            within_bbox = gdf.geometry.within(tunnel_bbox)
            gdf_outside_bbox = gdf[~within_bbox]
            # print('★★★')
            # print(gdf_outside_bbox)
            # possible_matches_index = list(road.index.intersection(tunnel_bbox.bounds))
            # possible_matches = road.iloc[possible_matches_index]

            # トンネル内の座標を除外
            # ★★2024/06/26 ああああ、ここでうまくとりのぞけてないのかな、治すべき所はこの辺な気がする。ん？でもこれでもうまくいかんか？
            road_coords = [coord for geom in tunnel_edges_intersects.geometry for coord in geom.coords]
            road_coords = [coord for coord in road_coords if not tunnel_bbox.contains(Point(coord))]

            # 最も近い座標を探す
            nearest_point = min(road_coords, key=lambda x: Point(x).distance(Point(point)))
            return nearest_point
        
        # print(precise_matches)
        if tunnel_edges_intersects.empty:
            # 本来ありえないと思うがトンネルがない場合はそのまま返す
            return row['elevation']
        else:
            # トンネルの範囲内の標高をすべて書き換える
            elevation_adjusted = row.elevation.copy()

            # 2024/06/26 ここでトンネルのエッジが4つ取得されるが、正しくは2つな気がする。
            print('tunne-edge-count:')
            print(len(tunnel_edges_intersects))
            print(tunnel_edges_intersects)
            
            for i, tunnel_edge in tunnel_edges_intersects.iterrows():
                coords = list(tunnel_edge.geometry.coords)
                
                # ★トンネルの始点と終点が線形になるように標高を調整
                # print(list(row.geometry.coords))
                base_edge_coords = list(row.geometry.coords)
                # ★★★★

                tunnel_bbox = tunnel_edge.geometry.envelope
                # トンネルの始点と終点に最も近い道のトンネル外の座標を取得
                # 2024/06/26 うん。やっぱりここが治ればうまくいく気がする。
                nearest_outside_start = get_nearest_outside_point(row, coords[0], tunnel_bbox)
                nearest_outside_end = get_nearest_outside_point(row, coords[-1], tunnel_bbox)
                start_idx = base_edge_coords.index(nearest_outside_start)
                end_idx = base_edge_coords.index(nearest_outside_end)
            
                def linear_interpolation(arr, start_idx, end_idx) -> List[int]:
                    # 開始値と終了値を取得
                    start_value = arr[start_idx]
                    end_value = arr[end_idx]
                    # print('1')
                    # 補間する点数
                    
                    # 線形補間を行う
                    # print('2')

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
                # print(res)
            # print(elevation_adjusted)
            return elevation_adjusted

            # start_idx = row.geometry.coords.index((coords[0][0], coords[0][1]))
            # end_idx = row.geometry.coords.index((coords[-1][0], coords[-1][1]))
        
            

    results = gdf.apply(func, axis=1)
    return results
