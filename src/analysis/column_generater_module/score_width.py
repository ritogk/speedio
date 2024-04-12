from geopandas import GeoDataFrame
from pandas import Series
from .eye_measured_width import RoadCondition


# 道幅を評価する
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        eye_measured_width = row["eye_measured_width"]
        score = 0
        if eye_measured_width == RoadCondition.UNCONFIRMED.value:
            if row["lanes"] == "2":
                score += 0.5
            if row["is_alpsmap"] and row["alpsmap_min_width"] >= 5.5:
                score += 0.5
        else:
            if eye_measured_width == RoadCondition.COMFORTABLE.value:
                score = 1
            elif eye_measured_width == RoadCondition.PASSABLE.value:
                score = 0.6
            elif eye_measured_width == RoadCondition.UNPLEASANT.value:
                score = 0
        return score

    series = gdf.apply(func, axis=1)
    return series
