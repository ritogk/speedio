from geopandas import GeoDataFrame
from pandas import Series

# 定数（DOMから取得する値の代わり）
WEIGHTS = {
    "elevation": 0.7,
    "elevation_deviation": 0.5,
    "elevation_unevenness": 1,  
    "width": 1,
    "length": 0.7,
    "building": 1,
    "corner_week": 0,
    "corner_medium": 0,
    "corner_strong": 0,
    "corner_none": 0,
    "corner_balance": 1,
}


# 道幅を評価する
# 道幅で信頼できる情報源がlanesとalpsmapしかないのでその情報をもとに評価する
def generate(gdf: GeoDataFrame, type: str) -> Series:
    def func(x):
        # スコア計算
        if(type == 'normal'):
            return (
                x["score_elevation"] * WEIGHTS["elevation"]
                + x["score_elevation_unevenness"] * WEIGHTS["elevation_unevenness"]
                + x["score_elevation_deviation"] * WEIGHTS["elevation_deviation"]
                + x["score_width"] * WEIGHTS["width"]
                + x["score_length"] * WEIGHTS["length"]
                + x["score_building"] * WEIGHTS["building"]
                + x["score_corner_week"] * WEIGHTS["corner_week"]
                + x["score_corner_medium"] * WEIGHTS["corner_medium"]
                + x["score_corner_strong"] * WEIGHTS["corner_strong"]
                + x["score_corner_none"] * WEIGHTS["corner_none"]
                + x["score_corner_balance"] * WEIGHTS["corner_balance"]
            ) / len(WEIGHTS)
        else:
            # 調査のためのcsv出力用
            weights = WEIGHTS.copy()
            weights["width"] = 0

            if type == 'week_corner':
                weights["corner_week"] = 2.7
                weights["corner_medium"] = 0.6
                weights["corner_strong"] = 0.6
                weights["corner_none"] = 0
                weights["corner_balance"] = 0
            elif type == 'medium_corner':
                weights["corner_week"] = 0.6
                weights["corner_medium"] = 2.7
                weights["corner_strong"] = 0.6
                weights["corner_none"] = 0
                weights["corner_balance"] = 0
            elif type == 'strong_corner':
                weights["corner_week"] = 0.6
                weights["corner_medium"] = 0.6
                weights["corner_strong"] = 2.7
                weights["corner_none"] = 0
                weights["corner_balance"] = 0
            elif type == 'standard':
                weights["corner_week"] = 0
                weights["corner_medium"] = 0
                weights["corner_strong"] = 0
                weights["corner_none"] = 0
                weights["corner_balance"] = 1
            
            return (
                x["score_elevation"] * weights["elevation"]
                + x["score_elevation_unevenness"] * weights["elevation_unevenness"]
                + x["score_elevation_deviation"] * weights["elevation_deviation"]
                + x["score_width"] * weights["width"]
                + x["score_length"] * weights["length"]
                + x["score_building"] * weights["building"]
                + x["score_corner_week"] * weights["corner_week"]
                + x["score_corner_medium"] * weights["corner_medium"]
                + x["score_corner_strong"] * weights["corner_strong"]
                + x["score_corner_none"] * weights["corner_none"]
                + x["score_corner_balance"] * weights["corner_balance"]
            ) / len(weights)

    series = gdf.apply(func, axis=1)
    return series
