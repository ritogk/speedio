from geopandas import GeoDataFrame
from pandas import Series
from geopy.distance import geodesic
from .road_section import STRAIGHT_ANGLE

WEEK_CORNER_ANGLE_MIN = STRAIGHT_ANGLE
WEEK_CORNER_ANGLE_MAX = 45
MEDIUM_CORNER_ANGLE_MIN = 45
MEDIUM_CORNER_ANGLE_MAX = 80
STRONG_CORNER_ANGLE_MIN = 80

# 各コーナー種別の間のゾーン値(±5度)
# コーナー種別が切替る間を段階的に評価するために必要
CORNER_TRANSITION_ZOON = 5 

# # 現状のアルゴリズムの都合上、1000mのコーナーが存在してしまい、直線区間がなくコーナーの性質が薄いため450mとして帳尻を合わせる。
# # NOTE: https://www.notion.so/d2fe2f7ad1be47a9831863f20a83c0ac?pvs=4
# MAX_DISTANCE = 450  # 最大距離

def generate(gdf: GeoDataFrame) -> tuple[Series, Series, Series]:
    def func(x):
        road_section = x.road_section
        length = sum(item['distance'] for item in road_section) 
        section_st_p = road_section[0]['points'][0]
        section_ed_p = road_section[-1]['points'][-1]
        coords = list(x.geometry.coords)
        # オリジナルの開始地点と終了地点はコーナーに含まれないのでその分の距離を計算する
        st_between_distance = 0
        ed_between_distance = 0
        if section_st_p != coords[0]:
            st_between_distance = geodesic(reversed(coords[0]), reversed(section_st_p)).meters
        if section_ed_p != coords[-1]:
            ed_between_distance = geodesic(reversed(coords[-1]), reversed(section_ed_p)).meters
        if(x.length / (length + st_between_distance + ed_between_distance) < 0.97):
            print('★★コーナーの距離と誤差あり。要確認')
            print(f"誤差: {x.length / (length + st_between_distance + ed_between_distance)} original:{x.length}, new:{length + st_between_distance + ed_between_distance}")
            print(coords)
        
        score_corner_week = 0
        score_corner_medium = 0
        score_corner_strong = 0
        score_corner_none = 0

        for item in road_section:
            angle = item['adjusted_steering_angle']
            distance = item['distance']
            
            if item['section_type'] == 'straight':
                score_corner_none += distance
            else:
                if WEEK_CORNER_ANGLE_MIN <= angle < MEDIUM_CORNER_ANGLE_MIN:
                    # 弱コーナーの計算
                    if angle < (WEEK_CORNER_ANGLE_MAX - CORNER_TRANSITION_ZOON):
                        score_corner_week += distance  # 完全に「弱」の領域
                    else:
                        # 境界付近は重み付け
                        transition_ratio = (WEEK_CORNER_ANGLE_MAX - angle) / CORNER_TRANSITION_ZOON
                        score_corner_week += distance * transition_ratio
                        score_corner_medium += distance * (1 - transition_ratio)
                elif MEDIUM_CORNER_ANGLE_MIN <= angle < STRONG_CORNER_ANGLE_MIN:
                    # 中コーナーの計算
                    if angle < (MEDIUM_CORNER_ANGLE_MAX - CORNER_TRANSITION_ZOON):
                        score_corner_medium += distance  # 完全に「中」の領域
                    else:
                        # 境界付近は重み付け
                        transition_ratio = (MEDIUM_CORNER_ANGLE_MAX - angle) / CORNER_TRANSITION_ZOON
                        score_corner_medium += distance * transition_ratio
                        score_corner_strong += distance * (1 - transition_ratio)

                elif STRONG_CORNER_ANGLE_MIN <= angle:
                    # 強コーナーの計算
                    score_corner_strong += distance  # 完全に「強」の領域
            # 総距離で正規化
            total_distance = score_corner_week + score_corner_medium + score_corner_strong + score_corner_none

        if total_distance > 0:
            score_corner_week /= total_distance
            score_corner_medium /= total_distance
            score_corner_strong /= total_distance
            score_corner_none /= total_distance

        return score_corner_week, score_corner_medium, score_corner_strong, score_corner_none

    results = gdf.apply(func, axis=1, result_type='expand')
    score_corner_week = results[0]
    score_corner_medium = results[1]
    score_corner_strong = results[2]
    score_corner_none = results[3]

    return score_corner_week, score_corner_medium, score_corner_strong, score_corner_none
