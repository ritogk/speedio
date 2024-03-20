from geopandas import GeoDataFrame
from pandas import Series
import osmnx as ox
import numpy as np


def generate(gdf: GeoDataFrame):
    # gdf["geometry"]でループ
    for index, row in gdf.iterrows():
        diff_total = 0
        for j in range(1, len(row.geometry.coords) - 1):
            diff = _calculate_angle_between_vectors(
                row.geometry.coords[j - 1],
                row.geometry.coords[j],
                row.geometry.coords[j + 1],
            )
            if diff > 80:
                print("★これだ")
                print(row.geometry.coords[j - 1])

            # print(diff)
            diff_total += diff
        # 座標間の角度の変化の合計値を求める
        # print(f"diff_total: {diff_total}")


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
