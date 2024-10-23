from geopandas import GeoDataFrame
from pandas import Series
from ...core.convert_range import convert_range

# コーナーの大きさを評価する
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        score_corner_week = row.score_corner_week
        score_corner_medium = row.score_corner_medium
        score_corner_strong = row.score_corner_strong
        score_corner_none = row.score_corner_none
        
        a_corner_score = score_corner_week + score_corner_none
        b_corner_score = score_corner_medium + score_corner_strong
        result = b_corner_score - a_corner_score

        if(result >= 0):
            return 1

        old_min, old_max = -1, 0
        new_min, new_max = 0, 1
        converted_value = convert_range(b_corner_score - a_corner_score, old_min, old_max, new_min, new_max)

        return converted_value

    series = gdf.apply(func, axis=1)
    return series