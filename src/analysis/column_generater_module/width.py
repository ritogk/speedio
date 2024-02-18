from geopandas import GeoDataFrame
from pandas import Series
import os
from pyproj import Transformer
from shapely.geometry import Point, LineString
from ...core.convert_linestrings_to_geojson import convert
from ...core.write_file import write
import pandas as pd

# 道幅計算モジュールを読み込む
from .core import road_width_calculator


# エッジの幅を求める
def generate(gdf: GeoDataFrame) -> tuple[Series, Series]:
    # アルプスマップのデータから道幅を求める
    # エッジが結合していると「YahooJapan/ALPSMAP;GSI ortorectified」のようなデータが含まれるが「YahooJapan/ALPSMAP」以外の道幅はタグから取得できないので、除外する
    alps_avg_series, alps_min_series = generate_from_alpsmap(
        gdf[(gdf["source"] == "YahooJapan/ALPSMAP") & pd.notna(gdf["yh:WIDTH"])]
    )

    # 国土地理院のデータから道幅を求める
    gsi_avg_series, gsi_min_series = generate_from_gsi(
        gdf[
            (gdf["source"] != "YahooJapan/ALPSMAP")
            | (gdf["source"] == "YahooJapan/ALPSMAP") & pd.isna(gdf["yh:WIDTH"])
        ]
    )

    # 結果を結合する
    avg_series = pd.concat([gsi_avg_series, alps_avg_series]).drop_duplicates()
    min_series = pd.concat([gsi_min_series, alps_min_series]).drop_duplicates()

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
    for geometry in geometry_series:
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
            print(f"width: {width}")
        # 道幅の平均値を求める
        if len(widths) == 0:
            geometry_width_avg_list.append(0)
        else:
            print(f"平均: {sum(widths) / len(widths)}")
            geometry_width_avg_list.append(sum(widths) / len(widths))
        # 道幅の最小値を求める
        if len(widths) == 0:
            geometry_width_min_list.append(0)
        else:
            print(f"最小: {min(widths)}")
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


# アルプスマップのタグから道幅を求める
# sample: ['1.5m〜3.0m', '5.5m〜13.0m', '1.5m未満', '3.0m〜5.5m', '13.0以上']
def generate_from_alpsmap(gdf: GeoDataFrame) -> tuple[Series, Series] | None:
    # 条件に基づいてシリーズを整形
    def format_min(x):
        if isinstance(x, str):
            if x == "1.5m未満":
                return 1.5
            if x == "13.0以上":
                return 13.0
            return float(x.split("〜")[0].replace("m", ""))
        elif isinstance(x, list):
            widths = []
            print(x)
            for item in x:
                values = item.split("〜")
                if values[0] == "1.5m未満":
                    widths.append(1.5)
                elif values[0] == "13.0以上":
                    widths.append(13.0)
                else:
                    widths.append(float(values[0].replace("m", "")))
            return min(widths)

    def format_avg(x):
        if isinstance(x, str):
            if x == "1.5m未満":
                return 1.5
            if x == "13.0以上":
                return 13.0
            min = float(x.split("〜")[0].replace("m", ""))
            max = float(x.split("〜")[1].replace("m", ""))
            return (min + max) / 2
        elif isinstance(x, list):
            widths = []
            for item in x:
                values = item.split("〜")
                if values[0] == "1.5m未満":
                    widths.append(1.5)
                    widths.append(1.5)
                elif values[0] == "13.0以上":
                    widths.append(13.0)
                else:
                    widths.append(float(values[0].replace("m", "")))
                    widths.append(float(values[1].replace("m", "")))
            return sum(widths) / len(widths)
            # cnt = 0
            # for item in x:
            #     min = float(item.split("〜")[0].replace("m", ""))
            #     max = float(item.split("〜")[1].replace("m", ""))
            #     cnt += min + max
            # return cnt / (len(x) * 2)

    min_series = gdf["yh:WIDTH"].apply(lambda x: format_min(x))
    avg_series = gdf["yh:WIDTH"].apply(lambda x: format_avg(x))

    return avg_series, min_series
