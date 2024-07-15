from geopandas import GeoDataFrame
from pandas import Series

WEEK_CORNER_ANGLE_MIN = 25
WEEK_CORNER_ANGLE_MAX = 41
MEDIUM_CORNER_ANGLE_MIN = 42
MEDIUM_CORNER_ANGLE_MAX = 60
STRONG_CORNER_ANGLE_MIN = 61
# 現状のアルゴリズムの都合上、1000mのコーナーが存在してしまい、直線区間がなくコーナーの性質が薄いため450mとして帳尻を合わせる。
# NOTE: https://www.notion.so/d2fe2f7ad1be47a9831863f20a83c0ac?pvs=4
MAX_DISTANCE = 450  # 最大距離

def generate(gdf: GeoDataFrame) -> tuple[Series, Series, Series]:
    def func(x):
        # 弱コーナーのスコア計算
        score_week_corner = sum(
            min(item['distance'], MAX_DISTANCE) for item in x.corners
            if (WEEK_CORNER_ANGLE_MIN <= item['angle'] <= WEEK_CORNER_ANGLE_MAX)
        ) / x.length
        # 中コーナーのスコア計算
        score_medium_corner = sum(
            min(item['distance'], MAX_DISTANCE) for item in x.corners
            if (MEDIUM_CORNER_ANGLE_MIN <= item['angle'] <= MEDIUM_CORNER_ANGLE_MAX)
        ) / x.length
        # 強コーナーのスコア計算
        score_strong_corner = sum(
            min(item['distance'], MAX_DISTANCE) for item in x.corners
            if item['angle'] >= STRONG_CORNER_ANGLE_MIN
        ) / x.length

        return score_week_corner, score_medium_corner, score_strong_corner

    results = gdf.apply(func, axis=1, result_type='expand')
    score_week_corner = results[0]
    score_medium_corner = results[1]
    score_strong_corner = results[2]

    return score_week_corner, score_medium_corner, score_strong_corner
