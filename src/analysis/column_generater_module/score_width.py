from geopandas import GeoDataFrame
from pandas import Series
import math
from .geometry_check_list import INTERVAL

# 目視検証データから道幅を評価する
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        locations = row.locations
        score = 0
        # 必要最低限の座標データがある場合のみに評価する
        if (len(locations) / (math.ceil(row.length / INTERVAL - 1))) >= 0.7:
            # ここに入ってこれるって事は十分なデータがあるって事
            for location in locations:
                if location['road_width_type'] == "TWO_LANE" or location['road_width_type'] == "TWO_LANE_SHOULDER":
                    score += 1
                elif location['road_width_type'] == "ONE_LANE_SPACIOUS":
                    score += 0.5
                elif location['road_width_type'] == "ONE_LANE":
                    score += 0.01
            # print(f"count: {len(locations)} score: {score/len(locations)}")
            return score/len(locations)
        else:
            if row["lanes"] == "2":
                score += 0.1
            if row["is_alpsmap"] and row["alpsmap_min_width"] >= 5.5:
                score += 0.3
            return score

    series = gdf.apply(func, axis=1)
    return series