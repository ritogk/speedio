from geopandas import GeoDataFrame
from pandas import Series

HIGHT_SPEED_CORNER_ANGLE_MIN = 25
HIGHT_SPEED_CORNER_ANGLE_MAX = 45
MEDIUM_SPEED_CORNER_ANGLE_MIN = 46
MEDIUM_SPEED_CORNER_ANGLE_MAX = 60
LOW_SPEED_CORNER_ANGLE_MIN = 61

def generate(gdf: GeoDataFrame) -> tuple[Series, Series, Series]:
    def func(x):
        # 高速コーナーのスコア計算
        score_high_speed_corner = sum(
            item['distance'] for item in x.corners if 25 <= item['angle'] <= 45
        ) / x.length
        # 中速コーナーのスコア計算
        score_medium_speed_corner = sum(
            item['distance'] for item in x.corners if 46 <= item['angle'] <= 60
        ) / x.length
        # 低速コーナーのスコア計算
        score_low_speed_corner = sum(
            item['distance'] for item in x.corners if item['angle'] >= 61
        ) / x.length

        return score_high_speed_corner, score_medium_speed_corner, score_low_speed_corner

    results = gdf.apply(func, axis=1, result_type='expand')
    score_high_speed_corner = results[0]
    score_medium_speed_corner = results[1]
    score_low_speed_corner = results[2]

    return score_high_speed_corner, score_medium_speed_corner, score_low_speed_corner
