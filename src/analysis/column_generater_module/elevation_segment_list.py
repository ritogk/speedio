from geopandas import GeoDataFrame
from pandas import Series
from shapely.geometry import LineString, Point

INTERVAL = 100

# 指定距離単位の標高一覧を生成する
def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        segment_index_list = generate_segment_point_index_list(x.geometry, 100, x.length)
        # elevation_dataからsegment_listのindexの値を抽出
        elevation_segment_list = []
        for segment_index in segment_index_list:
            # print(segment['index'])
            elevation_segment_list.append(x.elevation_smooth[segment_index])
        return elevation_segment_list

    results = gdf.apply(func, axis=1)

    return results


def generate_segment_point_index_list(line: LineString, interval: int, length:int) -> list[int]:
    # 全体の長さに基づいて、分割する区間数を計算
    num_intervals = int(length // interval) + 1
    point_indexs = []
    
    for i in range(num_intervals):
        # 総距離に対する進捗割合
        ratio = i * interval / length
        if ratio > 1:
            ratio = 1
        interpolated_point = line.interpolate(ratio * line.length)
        
        # 最寄りの点のインデックスを求める
        closest_index = min(range(len(line.coords)), key=lambda j: Point(line.coords[j]).distance(interpolated_point))
        point_indexs.append(closest_index)
    
    return point_indexs