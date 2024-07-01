from geopandas import GeoDataFrame
from pandas import Series

HIGHT_SPEED_CORNER_ANGLE_MIN = 25
HIGHT_SPEED_CORNER_ANGLE_MAX = 41
MEDIUM_SPEED_CORNER_ANGLE_MIN = 42
MEDIUM_SPEED_CORNER_ANGLE_MAX = 60
LOW_SPEED_CORNER_ANGLE_MIN = 61
# 現状のアルゴリズムの都合上、1000mのコーナーが存在してしまい、直線区間がなくコーナーの性質が薄いため450mとして帳尻を合わせる。
# NOTE: https://www.notion.so/d2fe2f7ad1be47a9831863f20a83c0ac?pvs=4
MAX_DISTANCE = 450  # 最大距離

def generate(gdf: GeoDataFrame) -> tuple[Series, Series, Series]:
    def func(x):
        # 高速コーナーのスコア計算
        score_high_speed_corner = sum(
            min(item['distance'], MAX_DISTANCE) for item in x.corners
            if (HIGHT_SPEED_CORNER_ANGLE_MIN <= item['angle'] <= HIGHT_SPEED_CORNER_ANGLE_MAX)
        ) / x.length
        # 中速コーナーのスコア計算
        score_medium_speed_corner = sum(
            min(item['distance'], MAX_DISTANCE) for item in x.corners
            if (MEDIUM_SPEED_CORNER_ANGLE_MIN <= item['angle'] <= MEDIUM_SPEED_CORNER_ANGLE_MAX)
        ) / x.length
        # 低速コーナーのスコア計算
        score_low_speed_corner = sum(
            min(item['distance'], MAX_DISTANCE) for item in x.corners
            if item['angle'] >= LOW_SPEED_CORNER_ANGLE_MIN
        ) / x.length

        return score_high_speed_corner, score_medium_speed_corner, score_low_speed_corner

    results = gdf.apply(func, axis=1, result_type='expand')
    score_high_speed_corner = results[0]
    score_medium_speed_corner = results[1]
    score_low_speed_corner = results[2]

    return score_high_speed_corner, score_medium_speed_corner, score_low_speed_corner
