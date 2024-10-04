from geopandas import GeoDataFrame
from pandas import Series
from shapely.geometry import LineString, Point
from geopy.distance import geodesic

INTERVAL = 100

# 標高の区間リストを生成する
def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        segment_index_list = interpolate_point_index_list(x.geometry, 100, x.length)
        # elevation_dataからsegment_listのindexの値を抽出
        elevation_segment_list = []
        for segment in segment_index_list:
            # print(segment['index'])
            elevation_segment_list.append(x.elevation_smooth[segment['index']])
        return elevation_segment_list

    results = gdf.apply(func, axis=1)

    return results


def interpolate_point_index_list(line: LineString, interval: int, length:int) -> list[list[Point, Point]]:
    point_indexs = [{"index": 0, "distance": 0}]
    distance = 0
    old_point = line.coords[0]
    for index, point in enumerate(line.coords):
        # x, y = point
        if index + 1 >= len(line.coords):
            if distance != 0:
                point_indexs.append({"index": len(line.coords) - 1, "distance": distance})
            continue
        next_point = line.coords[index + 1]
        distance += geodesic((point[1], point[0]), (next_point[1], next_point[0])).meters
        if distance >= interval:
            # print(old_point)
            # print(next_point)
            # print(distance)
            point_indexs.append({"index": index + 1, "distance": distance})
            distance = 0
            old_point = next_point
    return point_indexs