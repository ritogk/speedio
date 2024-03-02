from geopandas import GeoDataFrame
from pandas import Series

WEIGHTS = {
    "elevation": 1,
    "angle": 1,
}


def generate(gdf: GeoDataFrame) -> Series:
    # 重み付けされたスコアを生成する
    series = (gdf["score_elevation"] * WEIGHTS["elevation"]) * (
        gdf["score_angle"] * WEIGHTS["angle"]
    )
    return series
