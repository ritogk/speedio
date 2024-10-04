from geopandas import GeoDataFrame
from pandas import Series

# 定数（DOMから取得する値の代わり）
WEIGHTS = {
    "elevation": 0.7,
    "elevation_over_height": 1.0,  
    "elevation_deviation": 0.5,
    "elevation_peak": 1,
    "angle": 0,  
    "width": 1,
    "length": 0.7,
    "building": 1,
    "week_corner": 0,
    "medium_corner": 0,
    "strong_corner": 0,
    "straight": 0,
    "road_section_deviation": 1,
}


# 道幅を評価する
# 道幅で信頼できる情報源がlanesとalpsmapしかないのでその情報をもとに評価する
def generate(gdf: GeoDataFrame, type: str) -> Series:
    def func(x):
        # スコア計算
        if(type == 'normal'):
            return (
                x["score_elevation"] * WEIGHTS["elevation"]
                + (1 - x["score_elevation_over_heiht"] * WEIGHTS["elevation_over_height"])
                + x["score_elevation_peak"] * WEIGHTS["elevation_peak"]
                + x["score_elevation_deviation"] * WEIGHTS["elevation_deviation"]
                + x["score_angle"] * WEIGHTS["angle"]
                + x["score_width"] * WEIGHTS["width"]
                + x["score_length"] * WEIGHTS["length"]
                + x["score_building"] * WEIGHTS["building"]
                + x["score_corner_week"] * WEIGHTS["week_corner"]
                + x["score_corner_medium"] * WEIGHTS["medium_corner"]
                + x["score_corner_strong"] * WEIGHTS["strong_corner"]
                + x["score_corner_none"] * WEIGHTS["straight"]
                + x["score_road_section_deviation"] * WEIGHTS["road_section_deviation"]
            ) / len(WEIGHTS)
        else:
            # 調査のためのcsv出力用
            weights = WEIGHTS.copy()
            weights["width"] = 0

            if type == 'week_corner':
                weights["week_corner"] = 2.7
                weights["medium_corner"] = 0.6
                weights["strong_corner"] = 0.6
                weights["straight"] = 0
                weights["road_section_deviation"] = 0
            elif type == 'medium_corner':
                weights["week_corner"] = 0.6
                weights["medium_corner"] = 2.7
                weights["strong_corner"] = 0.6
                weights["straight"] = 0
                weights["road_section_deviation"] = 0
            elif type == 'strong_corner':
                weights["week_corner"] = 0.6
                weights["medium_corner"] = 0.6
                weights["strong_corner"] = 2.7
                weights["straight"] = 0
                weights["road_section_deviation"] = 0
            elif type == 'standard':
                weights["week_corner"] = 0
                weights["medium_corner"] = 0
                weights["strong_corner"] = 0
                weights["straight"] = 0
                weights["road_section_deviation"] = 1
            
            return (
                x["score_elevation"] * weights["elevation"]
                + (1 - x["score_elevation_over_heiht"] * weights["elevation_over_height"])
                + x["score_elevation_peak"] * weights["elevation_peak"]
                + x["score_elevation_deviation"] * weights["elevation_deviation"]
                + x["score_angle"] * weights["angle"]
                + x["score_width"] * weights["width"]
                + x["score_length"] * weights["length"]
                + x["score_building"] * weights["building"]
                + x["score_corner_week"] * weights["week_corner"]
                + x["score_corner_medium"] * weights["medium_corner"]
                + x["score_corner_strong"] * weights["strong_corner"]
                + x["score_corner_none"] * weights["straight"]
                + x["score_road_section_deviation"] * weights["road_section_deviation"]
            ) / len(weights)

    series = gdf.apply(func, axis=1)
    return series
