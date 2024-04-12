from geopandas import GeoDataFrame
from pandas import Series
import osmnx as ox
import numpy as np

from .core.calculate_angle_between_vectors import calculate_angle_between_vectors


def generate(gdf: GeoDataFrame) -> Series:
    # 座標間の角度の変化の合計値を求める
    series = gdf["geometry"].apply(
        lambda x: sum(
            [
                calculate_angle_between_vectors(
                    x.coords[i - 1], x.coords[i], x.coords[i + 1]
                )
                or 0
                for i in range(1, len(x.coords) - 1)
            ]
        )
    )
    return series
