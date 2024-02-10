from geopandas import GeoDataFrame
from pandas import Series
import os
from pyproj import Transformer
from shapely.geometry import Point, LineString
from ...core.convert_linestrings_to_geojson import convert
from ...core.write_file import write


# 道幅計算モジュールを読み込む
from .core import road_width_calculator


# エッジの幅を求める
def generate(gdf: GeoDataFrame) -> Series:
    center_path = f"{os.path.dirname(os.path.abspath(__file__))}/_center"
    rdedg_path = f"{os.path.dirname(os.path.abspath(__file__))}/_rdedg"
    calclator = road_width_calculator.RoadWidthCalculator(center_path, rdedg_path)
    # 座標間の角度の変化の合計値を求める
    # a = gdf["length"]
    # print(a)
    geometry_series = gdf["geometry"].apply(
        lambda x: interpolate_points_with_offset(x, 50, 1)
    )
    # print(series)
    geometry_width_list = []
    result_list = []
    # seriesをループさせる
    for geometry in geometry_series:
        widths = []
        for points in geometry:
            st_point = points[0]
            ed_point = points[1]
            result = calclator.calculate(st_point, ed_point)
            if result is None:
                continue
            result_list.append(result)
            width = result["distance"]
            widths.append(width * 2)
            print(f"width: {width * 2}")
        # 平均値を求める
        if len(widths) == 0:
            geometry_width_list.append(0)
        else:
            print(f"平均: {sum(widths) / len(widths)}")
            geometry_width_list.append(sum(widths) / len(widths))

    geojson = convert(
        [[d[k] for k in ["line", "base_line"] if k in d] for d in result_list]
    )
    write(geojson, "output.geojson")
    # widthをseriesに変換する
    series = Series(geometry_width_list, index=gdf.index)
    return series


def interpolate_points_with_offset(
    line: LineString, interval: int, offset: int
) -> list[list[Point, Point]]:
    # print(1)
    # print(line)
    # lineStringを平面直角座標系に変換
    transformer = Transformer.from_crs(4326, 6677)
    # LineString内のpyprojが扱える形式に変換(y(経度), x(緯度))する
    trans_coords = transformer.itransform(line.coords, switch=True)
    line = LineString(trans_coords)
    length = line.length

    # 指定した間隔で点を生成し、さらにオフセット分進んだ点も生成
    points = []
    for dist in range(0, int(length), interval):
        point = line.interpolate(dist)
        # print(point)
        offset_point = line.interpolate(dist + offset)
        # print(offset_point)
        points.append([point, offset_point])

    # # 線の端点も含める（オフセットは考慮しない）
    # if not line.boundary[1].equals(points[-1][0]):
    #     points.append((line.boundary[1], None))
    # print
    # print(points)
    # 平面直角座標系から緯度経度系に変換
    transformer = Transformer.from_crs(6677, 4326, always_xy=True)
    points = [
        [
            Point(transformer.transform(p[0].x, p[0].y)),
            Point(transformer.transform(p[1].x, p[1].y)),
        ]
        for p in points
    ]
    return points
