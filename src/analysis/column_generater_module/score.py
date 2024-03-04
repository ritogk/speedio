from geopandas import GeoDataFrame
from pandas import Series

WEIGHTS = {
    "elevation": 1,
    "elvation_over_height": 0.3,  # 負の評価なので逆転して使う事。
    "angle": 1,
}


def generate(gdf: GeoDataFrame) -> Series:
    # 重み付けされたスコアを生成する
    series = (
        (gdf["score_elevation"] * WEIGHTS["elevation"])
        * (1 - (gdf["score_elevation_over_heiht"] * WEIGHTS["elvation_over_height"]))
        * (gdf["score_angle"] * WEIGHTS["angle"])
    )
    return series
