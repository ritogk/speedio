from geopandas import GeoDataFrame
from pandas import Series

# 定数（DOMから取得する値の代わり）
WEIGHTS = {
    "elevation": 0.8,  # 例として1.0を使用
    "elvation_over_height": 1.0,  # 例として1.0を使用
    "elevation_u_shape": 1.0,  # 例として1.0を使用
    "angle": 1.0,  # 例として1.0を使用
    "width": 1.0,  # 例として1.0を使用
    "visually_verified_width": 1.0,
    "length": 0.5,  # 例として1.0を使用
}


# 道幅を評価する
# 道幅で信頼できる情報源がlanesとalpsmapしかないのでその情報をもとに評価する
def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        # スコア計算
        return (
            x["score_elevation"] * WEIGHTS["elevation"]
            + (1 - x["score_elevation_over_heiht"] * WEIGHTS["elvation_over_height"])
            + x["score_elevation_u_shape"] * WEIGHTS["elevation_u_shape"]
            + x["score_angle"] * WEIGHTS["angle"]
            + x["score_width"] * WEIGHTS["width"]
            + x["score_visually_verified_width"] * WEIGHTS["visually_verified_width"]
            + x["score_length"] * WEIGHTS["length"]
        ) / len(WEIGHTS)

    series = gdf.apply(func, axis=1)
    return series
