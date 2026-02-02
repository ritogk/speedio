from geopandas import GeoDataFrame
from pandas import Series

# Claude の検証データからセンターラインのある範囲を評価する
# 基本ロジックは score_center_line_section と同じで、
# locations 内の claude_has_center_line プロパティを見る。
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        locations = row.locations
        center_line_count = 0
        for location in locations:
            if location.get("claude_has_center_line"):
                center_line_count += 1

        if center_line_count == 0:
            return 0
        else:
            # 頭と末尾の座標は評価されないはずなので取り除く
            score = center_line_count / ((row.length / 500) - 2)
            if score > 1:
                score = 1
            return score

    series = gdf.apply(func, axis=1)
    return series
