from geopandas import GeoDataFrame
from pandas import Series

# 定数（DOMから取得する値の代わり）
WEIGHTS = {
    "elevation": 0.4,
    "elvation_over_height": 1.0,  
    "elevation_u_shape": 1.0,  
    "angle": 0,  
    "width": 1,
    "length": 0.6,
    "week_corner": 1,
    "medium_corner": 1,
    "strong_corner": 1,
}


# 道幅を評価する
# 道幅で信頼できる情報源がlanesとalpsmapしかないのでその情報をもとに評価する
def generate(gdf: GeoDataFrame, corner_type: str) -> Series:
    def func(x):
        # スコア計算
        if(corner_type == 'elevation_fluctuation'):
            return (
                x["score_elevation"] * WEIGHTS["elevation"]
                + (1 - x["score_elevation_over_heiht"] * WEIGHTS["elvation_over_height"])
                + x["score_elevation_u_shape"] * WEIGHTS["elevation_u_shape"]
                + x["score_angle"] * WEIGHTS["angle"]
                + x["score_width"] * WEIGHTS["width"]
                + x["score_length"] * WEIGHTS["length"]
                + x["score_week_corner"] * WEIGHTS["week_corner"]
                + x["score_medium_corner"] * WEIGHTS["medium_corner"]
                + x["score_strong_corner"] * WEIGHTS["strong_corner"]
            ) / len(WEIGHTS)
        else:
            # 調査のためのcsv出力用
            return (
                x["score_elevation"] * WEIGHTS["elevation"]
                + (1 - x["score_elevation_over_heiht"] * WEIGHTS["elvation_over_height"])
                + x["score_elevation_u_shape"] * WEIGHTS["elevation_u_shape"]
                + x["score_angle"] * WEIGHTS["angle"]
                + x["score_width"] * 0
                + x["score_length"] * WEIGHTS["length"]
                + x["score_week_corner"] * (2 if corner_type == 'week_corner' else 1)
                + x["score_medium_corner"] * (2 if corner_type == 'medium_corner' else 1)
                + x["score_strong_corner"] * (2 if corner_type == 'strong_corner' else 1)
            ) / len(WEIGHTS)

    series = gdf.apply(func, axis=1)
    return series
