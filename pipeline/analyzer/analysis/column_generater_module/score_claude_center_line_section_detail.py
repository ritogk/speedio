from geopandas import GeoDataFrame
from pandas import Series


def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        locations = row.locations
        if len(locations) <= 2:
            return 0
        # 頭と末尾の座標は評価されないので取り除く
        inner = locations[1:-1]
        scores = [loc["claude_center_line_score"] for loc in inner if loc.get("claude_center_line_score") is not None]
        if not scores:
            return 0
        return sum(scores) / len(scores)

    series = gdf.apply(func, axis=1)
    return series
