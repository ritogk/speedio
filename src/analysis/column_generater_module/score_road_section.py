from geopandas import GeoDataFrame
from pandas import Series
from geopy.distance import geodesic

WEEK_CORNER_ANGLE_MIN = 22
WEEK_CORNER_ANGLE_MAX = 45
MEDIUM_CORNER_ANGLE_MIN = 45
MEDIUM_CORNER_ANGLE_MAX = 80
STRONG_CORNER_ANGLE_MIN = 80
# 現状のアルゴリズムの都合上、1000mのコーナーが存在してしまい、直線区間がなくコーナーの性質が薄いため450mとして帳尻を合わせる。
# NOTE: https://www.notion.so/d2fe2f7ad1be47a9831863f20a83c0ac?pvs=4
MAX_DISTANCE = 450  # 最大距離

def generate(gdf: GeoDataFrame) -> tuple[Series, Series, Series]:
    def func(x):
        road_section = x.road_section
        length = sum(item['distance'] for item in road_section) 
        corner_st_p = road_section[0]['points'][0]
        corner_ed_p = road_section[-1]['points'][-1]
        coords = list(x.geometry.coords)
        # オリジナルの開始地点と終了地点はコーナーに含まれないのでその分の距離を計算する
        st_between_distance = 0
        ed_between_distance = 0
        if corner_st_p != coords[0]:
            st_between_distance = geodesic(reversed(coords[0]), reversed(corner_st_p)).meters
        if corner_ed_p != coords[-1]:
            ed_between_distance = geodesic(reversed(coords[-1]), reversed(corner_ed_p)).meters
        if(x.length / (length + st_between_distance + ed_between_distance) < 0.97):
            print('★★コーナーの距離と誤差あり。要確認')
            print(f"誤差: {x.length / (length + st_between_distance + ed_between_distance)} original:{x.length}, new:{length + st_between_distance + ed_between_distance}")

        # 弱コーナーのスコア計算
        score_week_corner = sum(
            min(item['distance'], MAX_DISTANCE) for item in road_section
            if (WEEK_CORNER_ANGLE_MIN <= item['adjusted_steering_angle'] < WEEK_CORNER_ANGLE_MAX)
        ) / length
        # 中コーナーのスコア計算
        score_medium_corner = sum(
            min(item['distance'], MAX_DISTANCE) for item in road_section
            if (MEDIUM_CORNER_ANGLE_MIN <= item['adjusted_steering_angle'] < MEDIUM_CORNER_ANGLE_MAX)
        ) / length
        # 強コーナーのスコア計算
        score_strong_corner = sum(
            min(item['distance'], MAX_DISTANCE) for item in road_section
            if STRONG_CORNER_ANGLE_MIN <= item['adjusted_steering_angle']
        ) / length
        # ストレートのスコア計算
        score_straight = sum(
            item['distance'] for item in road_section
            if (item['section_type'] == 'straight')
        ) / length

        # if(x.length == 7187.297999999998):
        #     print('week')
        #     print(sum(
        #         min(item['distance'], MAX_DISTANCE) for item in x.corners
        #         if (WEEK_CORNER_ANGLE_MIN <= item['adjusted_steering_angle'] < WEEK_CORNER_ANGLE_MAX)
        #     ))
        #     print('medium')
        #     print(sum(
        #         min(item['distance'], MAX_DISTANCE) for item in x.corners
        #         if (MEDIUM_CORNER_ANGLE_MIN <= item['adjusted_steering_angle'] < MEDIUM_CORNER_ANGLE_MAX)
        #     ))
        #     print('strong')
        #     print(sum(
        #         min(item['distance'], MAX_DISTANCE) for item in x.corners
        #         if STRONG_CORNER_ANGLE_MIN <= item['adjusted_steering_angle']
        #     ))
        #     print('all')
        #     print(length)

        return score_week_corner, score_medium_corner, score_strong_corner, score_straight

    results = gdf.apply(func, axis=1, result_type='expand')
    score_week_corner = results[0]
    score_medium_corner = results[1]
    score_strong_corner = results[2]
    score_straight = results[3]

    return score_week_corner, score_medium_corner, score_strong_corner, score_straight
