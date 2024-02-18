from geopandas import GeoDataFrame
from pandas import Series
import os
from pyproj import Transformer
from shapely.geometry import Point, LineString
from ...core.convert_linestrings_to_geojson import convert
from ...core.write_file import write
from tqdm import tqdm

# 道幅計算モジュールを読み込む
from .core import road_width_calculator


# エッジの幅を求める
def generate(gdf: GeoDataFrame) -> tuple[Series, Series]:
    # 国土地理院のデータから道幅を求める
    avg_series, min_series = generate_from_gsi(gdf)

    return avg_series, min_series


# 国土地理院のデータから道幅を求める
def generate_from_gsi(gdf: GeoDataFrame) -> tuple[Series, Series] | None:
    center_path = f"{os.path.dirname(os.path.abspath(__file__))}/_center"
    rdedg_path = f"{os.path.dirname(os.path.abspath(__file__))}/_rdedg"
    calclator = road_width_calculator.RoadWidthCalculator(center_path, rdedg_path)

    geometry_series = gdf["geometry"].apply(
        lambda x: interpolate_points_with_offset(x, 50, 1)
    )
    # print(series)
    geometry_width_avg_list = []
    geometry_width_min_list = []
    result_list = []
    # seriesをループさせる
    for geometry in tqdm(geometry_series):
        widths = []
        for points in geometry:
            st_point = points[0]
            ed_point = points[1]
            result = calclator.calculate(st_point, ed_point)
            if result is None:
                continue
            result_list.append(result[0])
            result_list.append(result[1])
            width = result[0]["distance"] + result[1]["distance"]
            widths.append(width)
            # print(f"width: {width}")
        # 道幅の平均値を求める
        if len(widths) == 0:
            geometry_width_avg_list.append(0)
        else:
            # print(f"平均: {sum(widths) / len(widths)}")
            geometry_width_avg_list.append(sum(widths) / len(widths))
        # 道幅の最小値を求める
        if len(widths) == 0:
            geometry_width_min_list.append(0)
        else:
            # print(f"最小: {min(widths)}")
            geometry_width_min_list.append(min(widths))

    geojson = convert(
        [[d[k] for k in ["line", "base_line"] if k in d] for d in result_list]
    )
    write(geojson, "output.geojson")
    # widthをseriesに変換する

    # gdf["geometry"]内のLineStringをgeojsonに変換する
    a = []
    for index, row in gdf.iterrows():
        a.append(row["geometry"])
    geojson = convert([a])
    write(geojson, f"output_geometry.geojson")

    avg_series = Series(geometry_width_avg_list, index=gdf.index)
    min_series = Series(geometry_width_min_list, index=gdf.index)
    return avg_series, min_series


def interpolate_points_with_offset(
    line: LineString, interval: int, offset: int
) -> list[list[Point, Point]]:
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
