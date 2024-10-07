from geopandas import GeoDataFrame
from pandas import Series

from .core.calculate_angle_between_vectors import calculate_angle_between_vectors


def generate(gdf: GeoDataFrame) -> Series:
    # 座標間の角度の変化の合計値を求める
    def func(row):
        coords = list(row.geometry.coords)
        angle_total = 0
        for i in range(1, len(coords) - 1):
            result = calculate_angle_between_vectors(
                            coords[i - 1], coords[i], coords[i + 1]
                        )
            if result is None:
                continue
            else:
                angle = result[0]
                angle_total += angle
        return angle_total

    series = gdf.apply(func, axis=1)
    return series
