from geopandas import GeoDataFrame
from pandas import Series
from shapely.geometry import LineString, Point
from geopy.distance import geodesic


def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        segments = interpolate_points(row.geometry, 250, row.length)
        return [[segment[1], segment[0]] for segment in segments]   

    series = gdf.apply(func, axis=1)
    return series


def interpolate_points(line: LineString, interval: int, length:int) -> list[list[Point, Point]]:
    points = [line.coords[0]]
    distance = 0
    for index, point in enumerate(line.coords):
        # x, y = point
        if index + 1 >= len(line.coords):
            if distance != 0:
                points.append(line.coords[-1])
            continue
        next_point = line.coords[index + 1]
        distance += geodesic((point[1], point[0]), (next_point[1], next_point[0])).meters
        if distance > interval:
            points.append(next_point)
            distance = 0
    return points
