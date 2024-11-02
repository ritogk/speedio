import numpy as np
from pyproj import Proj, Transformer
from ..analysis.column_generater_module.core import elevation_service
import json
from geopandas import GeoDataFrame
import hashlib
import os
from pandas import Series
from tqdm import tqdm

def generate_terrain_elevation(plane_epsg_code, tif_path, lat_min, lon_min, lat_max, lon_max) -> list:
    # 緯度経度からEPSG:4326 (WGS84) に変換するための投影を設定
    wgs84 = Proj('epsg:4326')  # WGS84 (緯度経度)
    japan_plane = Proj(f"epsg:{plane_epsg_code}")  # 日本の平面直角座標系（ゾーン9を例とする）
    
      # Transformerを使って座標変換用のオブジェクトを作成
    transformer_to_plane = Transformer.from_proj(wgs84, japan_plane)
    transformer_to_wgs84 = Transformer.from_proj(japan_plane, wgs84)

    # BBoxの緯度経度を平面直角座標に変換
    x_min, y_min = transformer_to_plane.transform(lon_min, lat_min)
    x_max, y_max = transformer_to_plane.transform(lon_max, lat_max)

    expand_distance = 50  # 拡張する距離（メートル）
    x_min -= expand_distance
    x_max += expand_distance
    y_min -= expand_distance
    y_max += expand_distance

    # print(lat_min, lon_min)
    # print(lat_max, lon_max)
    # print(x_min, y_min, x_max, y_max)
    
    # 指定間隔のグリッドを作成
    mesh_size = 10  # メッシュサイズ(m)
    x_coords = np.arange(x_min, x_max, mesh_size)  # x方向
    y_coords = np.arange(y_min, y_max, mesh_size)  # y方向
    
    # グリッドの座標を生成
    grid_x, grid_y = np.meshgrid(x_coords, y_coords)
    
    # 平面直角座標から緯度経度に逆変換
    lon_grid, lat_grid = transformer_to_wgs84.transform(grid_x, grid_y)
    
    # 緯度と経度のグリッドを1つの3次元配列に統合
    lat_lon_grid = np.dstack((lat_grid, lon_grid))

    # Elevation Serviceのインスタンスを作成
    elevation_service_ins = elevation_service.ElevationService(tif_path)
    
    # 1次元配列にするためのリスト
    lat_lon_elev_grid = np.zeros((lat_grid.shape[0], lat_grid.shape[1], 3))
    
    for i in range(len(lat_lon_grid)):
        for j in range(len(lat_lon_grid[i])):
            lat = lat_lon_grid[i][j][1]
            lon = lat_lon_grid[i][j][0]

            # 緯度経度をそのまま使用して標高を取得
            elevation = int(elevation_service_ins.get_elevation(lat, lon))
            
            if elevation is None:
                print(f"Elevation is None for lat: {lat}, lon: {lon}")
            else:
                # # 平面直角座標に再変換してリストに追加
                # terrain_elevations.append([lat, lon, elevation])
                lat_lon_elev_grid[i, j] = [lat, lon, int(elevation)]
    
    # terrain_elevationsをNumPy配列に変換
    # terrain_elevations = np.array(terrain_elevations)

    # 緯度経度から平面直角座標に変換
    flat_x, flat_y = transformer_to_plane.transform(lat_lon_elev_grid[:, :, 0], lat_lon_elev_grid[:, :, 1])

    # 結果をlat_lon_elev_gridに反映 (緯度経度を平面直角座標に置き換え)
    lat_lon_elev_grid[:, :, 0] = flat_x  # x座標（平面直角座標）
    lat_lon_elev_grid[:, :, 1] = flat_y  # y座標（平面直角座標）

    # xとy座標を整数に変換(データサイズを減らすため)
    lat_lon_elev_grid[:, :, 0] = lat_lon_elev_grid[:, :, 0].astype(int)
    lat_lon_elev_grid[:, :, 1] = lat_lon_elev_grid[:, :, 1].astype(int)

    return lat_lon_elev_grid.tolist()

def write_terrain_elevations_file(gdf_edges: GeoDataFrame, tif_path, plane_epsg_code:str):
    def func(row):
        bounds = row.geometry.bounds
        terrain_elevations = generate_terrain_elevation(plane_epsg_code, tif_path, bounds[0], bounds[1], bounds[2], bounds[3])

        # ファイルに出力する
        output_dir = f"{os.path.dirname(os.path.abspath(__file__))}/../../html/{row['terrain_elevation_file_path'].lstrip("./")}"
        os.makedirs(os.path.dirname(output_dir), exist_ok=True)
        with open(output_dir, "w") as f:
            f.write(str(terrain_elevations))
        return

    tqdm.pandas()
    gdf_edges.progress_apply(func, axis=1)

# ファイル出力用のハッシュ値を生成
def generate_file_path(gdf_edges: GeoDataFrame, prefecture_name:str) -> Series:
    def func(row):
        data = json.dumps([row.geometry.coords[0], row.geometry.coords[-1]]).encode()
        hash_object = hashlib.sha256(data)
        hash_value = hash_object.hexdigest()
        # index.htmlからの相対パス
        base_path = f'./terrain_elevations/{prefecture_name}/{hash_value}/terrain_elevation.json'
        return base_path

    series = gdf_edges.apply(func, axis=1)
    return series