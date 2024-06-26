from geopandas import GeoDataFrame
from pandas import Series

# 定数（DOMから取得する値の代わり）
WEIGHTS = {
    "elevation": 0.8,  
    "elvation_over_height": 1.0,  
    "elevation_u_shape": 1.0,  
    "angle": 0,  
    "width": 1,
    "length": 0.5, 
    "high_speed_corner": 0.5,
    "medium_speed_corner": 0.5,
    "low_speed_corner": 0.5,
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
            + x["score_length"] * WEIGHTS["length"]
            + x["score_high_speed_corner"] * WEIGHTS["high_speed_corner"]
            + x["score_medium_speed_corner"] * WEIGHTS["medium_speed_corner"]
            + x["score_low_speed_corner"] * WEIGHTS["low_speed_corner"]
        ) / len(WEIGHTS)

    series = gdf.apply(func, axis=1)
    return series
