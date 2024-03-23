from geopandas import GeoDataFrame
from pandas import Series
from .core.calculate_angle_between_vectors import calculate_angle_between_vectors


def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        candidates = []
        coords = list(row.geometry.coords)
        # 5つの点が必要なので、少なくともその長さが必要
        if len(coords) < 5:
            return candidates

        for j in range(2, len(coords) - 2):
            a = coords[j - 2]
            b = coords[j]
            c = coords[j + 2]
            angle_ab_bc = calculate_angle_between_vectors(
                a,
                b,
                c,
            )
            if angle_ab_bc is None:
                continue
            if angle_ab_bc > 80:
                # print(f"a: {a}, b: {b}, c: {c}")
                candidates.append({"a": a, "b": b, "c": c, "angle_ab_bc": angle_ab_bc})
        return candidates

    series = gdf.apply(func, axis=1)
    return series
