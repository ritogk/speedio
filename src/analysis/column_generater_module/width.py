from geopandas import GeoDataFrame
from pandas import Series
import osmnx as ox
import numpy as np
import os

# 道幅計算モジュールを読み込む
from .core import road_width_calculator

# エッジの幅を求める
def generate(gdf: GeoDataFrame) -> Series:
    center_path = f"{os.path.dirname(os.path.abspath(__file__))}/_center"
    rdedg_path = f"{os.path.dirname(os.path.abspath(__file__))}/_rdedg"
    calclator = road_width_calculator.RoadWidthCalculator(center_path, rdedg_path)

    # 座標間の角度の変化の合計値を求める
    series = gdf["geometry"].apply(
        lambda x: interpolate_points_with_offset(x, 50, 1)
        )
    # seriesをループさせる
    for i in range(len(series)):
        for j in range(len(series[i])):
            st_point = series[i][j][0]
            ed_point = series[i][j][1]
            width = calclator.calculate(st_point, ed_point)
            print(width)
    return series


def interpolate_points_with_offset(line, interval, offset):
    # 線の全長を取得
    length = line.length
    
    # 指定した間隔で点を生成し、さらにオフセット分進んだ点も生成
    points = []
    for dist in range(0, int(length), interval):
        point = line.interpolate(dist)
        offset_point = line.interpolate(dist + offset)
        points.append((point, offset_point))
    
    # # 線の端点も含める（オフセットは考慮しない）
    # if not line.boundary[1].equals(points[-1][0]):
    #     points.append((line.boundary[1], None))
    
    return points
