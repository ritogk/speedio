from geopandas import GeoDataFrame
from pandas import Series
import osmnx as ox
import numpy as np


def generate(gdf: GeoDataFrame) -> Series:
    # 座標間の角度の変化の合計値を求める
    series = gdf["geometry"].apply(
        lambda x: sum(
            [
                _calculate_angle_between_vectors(
                    x.coords[i - 1], x.coords[i], x.coords[i + 1]
                )
                for i in range(1, len(x.coords) - 1)
            ]
        )
    )
    return series


# ベクトル間の角度を計算する
def _calculate_angle_between_vectors(A, B, C):
    vector_AB = np.array(B) - np.array(A)
    vector_BC = np.array(C) - np.array(B)

    dot_product = np.dot(vector_AB, vector_BC)
    norm_AB = np.linalg.norm(vector_AB)
    norm_BC = np.linalg.norm(vector_BC)

    cosine_theta = dot_product / (norm_AB * norm_BC)
    angle_rad = np.arccos(cosine_theta)
    angle_deg = np.degrees(angle_rad)
    return angle_deg
