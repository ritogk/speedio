from geopandas import GeoDataFrame
from pandas import Series
from .core.calculate_angle_between_vectors import calculate_angle_between_vectors


def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        candidates = []
        for j in range(1, len(row.geometry.coords) - 1):
            a = row.geometry.coords[j - 1]
            b = row.geometry.coords[j]
            c = row.geometry.coords[j + 1]
            angle_ab_bc = calculate_angle_between_vectors(
                a,
                b,
                c,
            )
            if angle_ab_bc > 80:
                # print("★曲がり角の候補")
                # print(f"center_point: {b[0]}, {b[1]}")
                candidates.append({"a": a, "b": b, "c": c, "angle_ab_bc": angle_ab_bc})
        return candidates

    series = gdf.apply(func, axis=1)

    return series
