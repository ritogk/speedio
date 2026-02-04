from geopandas import GeoDataFrame
from pandas import Series

# Claude の検証データからセンターラインのある範囲を評価する
# 基本ロジックは score_center_line_section と同じで、
# locations 内の claude_center_line プロパティを見る。
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        locations = row.locations
        center_line_count = 0
        print(locations)
        for location in locations:
            if (
                location.get("claude_center_line") is True
                # MEMO: 現状のプロンプトだと、中央線がない かつ 2車線 と推測されるとほぼ中央線ありのデータだっため、その場合も中央線ありとみなす
                or (
                    location.get("claude_center_line") is False
                    and location.get("claude_road_width_type") == "TWO_LANE"
                )
            ):
                center_line_count += 1
        print(f"center_line_count: {center_line_count}")
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
