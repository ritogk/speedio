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

        # ★ row.geometry(linestring)の各座標から15m以内に建物があるもののみを抽出
        # ★★★★ ここの計算がおかしいので治す必要あり！！！！！
        if row.length == 1604.959:
            print(row.start_point)
            print(row.length)
        match_buildings = []
        for coord in row.geometry.coords:
            point = Point(coord)
            for building in sindex_match_buildings.itertuples():
                # pointを中心に70m以内に建物があるかどうかを判定したい。
                building_point = building.geometry.centroid
                distance = geodesic((point.y, point.x), (building_point.y, building_point.x)).meters
                # print(distance)
                if row.length == 1604.959:
                    print(distance)
                    print('  ', point.y, point.x)
                    print('  ', building_point.y, building_point.x)
                if distance <= 70:
                    match_buildings.append(building.geometry)

        # 重複を排除したインデックスを用いて建物を取得
        print(match_buildings)
        # ★★★★ match_buildingsの横幅の距離を表示
        for i in range(len(match_buildings)):
            print(match_buildings[i].bounds[2] - match_buildings[i].bounds)

        match_buildings = list(dict.fromkeys(match_buildings))
        
        result = len(match_buildings)
        print(match_buildings)
        # if(result >= 1):
        #     print(row.start_point)
        # print(match_buildings)
        return result

    # tqdm.pandas()
    series = gdf.progress_apply(func, axis=1)

    return series
