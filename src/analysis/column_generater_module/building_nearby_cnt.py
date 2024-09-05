from geopandas import GeoDataFrame
from pandas import Series
from tqdm import tqdm
from geopy.distance import geodesic
from shapely.geometry import Point


# 
def generate(gdf: GeoDataFrame, gdf_buildings: GeoDataFrame) -> Series:
    # gdf_buildings の空間インデックスを作成
    sindex_buildings = gdf_buildings.sindex

    def func(row):
        bbox = row.geometry.bounds
        # ジオメトリーの境界ボックス内の建物のインデックスを取得
        sindex_match_indices = list(sindex_buildings.intersection(bbox))
        
        # 該当するインデックスから建物のジオメトリを取得
        sindex_match_buildings = gdf_buildings.iloc[sindex_match_indices]

        # # ★ row.geometry(linestring)の各座標から15m以内に建物があるもののみを抽出
        # # ★★★★ ここの計算がおかしいので治す必要あり！！！！！
        # if row.length == 1604.959:
        #     print(row.start_point)
        #     print(row.length)
        # match_buildings = []
        # for coord in row.geometry.coords:
        #     point = Point(coord)
        #     for building in sindex_match_buildings.itertuples():
        #         # pointを中心に70m以内に建物があるかどうかを判定したい。
        #         building_point = building.geometry.centroid
        #         distance = geodesic((point.y, point.x), (building_point.y, building_point.x)).meters
        #         # print(distance)
        #         if row.length == 1604.959:
        #             print(distance)
        #             print('  ', point.y, point.x)
        #             print('  ', building_point.y, building_point.x)
        #         if distance <= 70:
        #             match_buildings.append(building.geometry)

        # # 重複を排除したインデックスを用いて建物を取得
        # print(match_buildings)
        # # ★★★★ match_buildingsの横幅の距離を表示
        # for i in range(len(match_buildings)):
        #     print(match_buildings[i].bounds[2] - match_buildings[i].bounds)

        # match_buildings = list(dict.fromkeys(match_buildings))

        # 各座標から70m以内に建物があるものを抽出
        match_buildings = []
        for coord in row.geometry.coords:
            point = Point(coord)
            
            lat_factor = 1 / 111320  # 緯度方向の1度の距離（約111.32km）
            lon_factor = 1 / (111320 * abs(geodesic((coord[1], coord[0]), (coord[1], coord[0] + 1)).km))  # 経度方向の距離

            # 緯度経度のスケールに合わせたバッファ（50m）
            buffer_lat = 50 * lat_factor
            buffer_lon = 50 * lon_factor

            # 楕円形のバッファ（50m相当の範囲を作成
            buffer = point.buffer(buffer_lat).buffer(buffer_lon)
            
            for building in sindex_match_buildings.itertuples():
                # 建物がこのバッファの範囲に重なっているか確認
                if building.geometry.intersects(buffer):
                    match_buildings.append(building.Index)

        if row.length == 1604.959:
            pass
        # # 重複を排除 (shapely.geometry.equalsを使う)
        #  = []
        # for b in match_buildings:
        #     if not any(b.equals(ub) for ub in unique_buildings):
        #         unique_buildings.append(b)
        unique_buildings = list(dict.fromkeys(match_buildings))

        # # 横幅の距離を表示 (bounds[2] - bounds[0] で横幅を計算)
        # for building in unique_buildings:
        #     width = building.bounds[2] - building.bounds[0]
        #     print(f"Building width: {width}")
        
        result = len(unique_buildings)
        # print(unique_buildings)
        # print(match_buildings)
        # if(result >= 1):
        #     print(row.start_point)
        # print(match_buildings)
        return result

    # tqdm.pandas()
    series = gdf.progress_apply(func, axis=1)

    return series
