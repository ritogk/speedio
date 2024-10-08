from geopandas import GeoDataFrame
from pandas import Series
from shapely.geometry import LineString, Point

INTERVAL = 10

# 指定距離単位の標高一覧を生成する
def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        segment_index_list = generate_segment_elevation_list(x.geometry, INTERVAL, x.length, x.elevation_smooth)
        # elevation_dataからsegment_listのindexの値を抽出
        elevation_segment_list = []
        for segment_index in segment_index_list:
            elevation_segment_list.append(x.elevation_smooth[segment_index])        
        return elevation_segment_list

    results = gdf.apply(func, axis=1)

    return results


def generate_segment_elevation_list(line: LineString, interval: int, length:int, elevation: list[int]) -> list[int]:
    # 全体の長さに基づいて、分割する区間数を計算
    num_intervals = int(length // interval) + 1
    point_indexs = []

    coords = list(line.coords)
    
    # 距離に基づいてループ。次の座標までの距離を計算し、intervalに達しない場合
    old_coords_index = 0
    for i in range(num_intervals):
        # 総距離に対する進捗割合
        ratio = i * interval / length
        if ratio > 1:
            ratio = 1
        interpolated_point = line.interpolate(ratio * line.length)
        # ★interpolated_pointに最も近いpointのindex番号を取得
        # こいつが重い
        closest_index = min(range(len(coords)), key=lambda j: Point(coords[j]).distance(interpolated_point))
        
        # indexが昇順になるように調整
        if closest_index < old_coords_index:
            closest_index = old_coords_index
        if closest_index > old_coords_index + 3:
            closest_index = old_coords_index

        old_coords_index = closest_index
        
        
        point_indexs.append(closest_index)
    
    return point_indexs