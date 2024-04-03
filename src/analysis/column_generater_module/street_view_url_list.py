from geopandas import GeoDataFrame
from pandas import Series
from shapely.geometry import LineString, Point
from pyproj import Transformer


def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        segments = interpolate_points(row.geometry, 500)
        return "\n".join(
            [
                f"https://www.google.com/maps/@{segment.y},{segment.x},20?layer=c&cbll={segment.y},{segment.x}&cbp=12,0,0,0,0"
                for segment in segments
            ],
        )

    series = gdf.apply(func, axis=1)
    return series


def interpolate_points(line: LineString, interval: int) -> list[list[Point, Point]]:
    # lineStringを平面直角座標系に変換
    transformer = Transformer.from_crs(4326, 6677)
    # LineString内のpyprojが扱える形式に変換(y(経度), x(緯度))する
    trans_coords = transformer.itransform(line.coords, switch=True)
    line = LineString(trans_coords)
    length = line.length

    points = [line.interpolate(0)]
    for dist in range(0, int(length), interval):
        dist = (dist + interval) if (dist + interval) < length else length
        point = line.interpolate(dist)
        points.append(point)
    print(points)
    # 平面直角座標系から緯度経度系に変換
    transformer = Transformer.from_crs(6677, 4326, always_xy=True)
    points = [Point(transformer.transform(p.x, p.y)) for p in points]
    return points
