from geopandas import GeoDataFrame
from pandas import Series

WEIGHTS = {
    "elevation": 1,
    "elvation_over_height": 1,  # 負の評価なので逆転して使う事。
    "elevation_u_shape": 0.8,
    "angle": 1,
    "width": 1,
    "length": 0.5,
}


def generate(gdf: GeoDataFrame) -> Series:
    # 重み付けされたスコアを生成する
    series = (
        (gdf["score_elevation"] * WEIGHTS["elevation"])
        * (1 - (gdf["score_elevation_over_heiht"] * WEIGHTS["elvation_over_height"]))
        * (gdf["score_elevation_u_shape"] * WEIGHTS["elevation_u_shape"])
        * (gdf["score_angle"] * WEIGHTS["angle"])
        * (gdf["score_width"] * WEIGHTS["width"])
        * (gdf["score_length"] * WEIGHTS["length"])
    )
    return series
