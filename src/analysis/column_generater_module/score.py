from geopandas import GeoDataFrame
from pandas import Series

# 定数（DOMから取得する値の代わり）
WEIGHTS = {
    "elevation": 0.7,
    "elevation_unevenness": 1,  
    "width": 1.3,
    "length": 0.7,
    "building": 1,
    "tunnel_outside": 1,
    "corner": {
        "corner_week": 1,
        "corner_medium": 1.3,
        "corner_strong": 1,
        "corner_none": 1.3
    },
    "corner_balance": 1,
    "center_line_section": 1.3,
}


def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        return (
            x["score_elevation"] * WEIGHTS["elevation"]
            + x["score_elevation_unevenness"] * WEIGHTS["elevation_unevenness"]
            + x["score_width"] * WEIGHTS["width"]
            + x["score_length"] * WEIGHTS["length"]
            + x["score_building"] * WEIGHTS["building"]
            + x["score_tunnel_outside"] * WEIGHTS["tunnel_outside"]
            + (
                x["score_corner_week"] * WEIGHTS["corner"]["corner_week"]
                + x["score_corner_medium"] * WEIGHTS["corner"]["corner_medium"]
                + x["score_corner_strong"] * WEIGHTS["corner"]["corner_strong"]
                + x["score_corner_none"] * WEIGHTS["corner"]["corner_none"]
            )
            + x["score_corner_balance"] * WEIGHTS["corner_balance"]
            + x["score_center_line_section"] * WEIGHTS["center_line_section"]
        ) / len(WEIGHTS)

    series = gdf.apply(func, axis=1)
    return series
