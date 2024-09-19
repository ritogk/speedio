from geopandas import GeoDataFrame
from pandas import Series
from .elevation_u_shape import SectionType



def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        # チェック対象
        # elevation_sectionの区切りが多いか ※1 0~0.5
        # 3パターンの距離がおおよそひとしいか ※2 0~0.5 これは本当に正しいのか?
        # elevation_sectionの強度 ※3
        return len(x.elevation_group) / len(x.elevation_section)

        # 一旦※3ののぞいて評価する
        elevation_group = x.elevation_group
        up_distance = 0
        down_distance = 0
        flat_distance = 0
        for i, group in enumerate(elevation_group):
            # print(i, group)
            if group['section_type'] == SectionType.UP:
                up_distance += group['distance']
            if group['section_type'] == SectionType.DOWN:
                down_distance += group['distance']
            if group['section_type'] == SectionType.FLAT:
                flat_distance += group['distance']
        score_distance = 0
        # 0以外の最小値を求める
        # min_distance 
        if not (up_distance == 0 or down_distance == 0 or flat_distance == 0):
            score_distance = min(up_distance, down_distance, flat_distance) / max(up_distance ,down_distance ,flat_distance)
        print(score_distance)



        # # 1mで0.12mまでが限界値。
        # # 一旦 0.7
        # height_and_distance_ratio = len(x.elevation_group) / len(x.elevation_section)
        # print(height_and_distance_ratio)

        # # elevation_groupでループする必要あり
        # # flatとup, downの評価は分ける必要あり

        # if height_and_distance_ratio > HEIGHT_AND_DISTANCE_STRONG_RATIO:
        #     score = 1
        # elif height_and_distance_ratio < HEIGHT_AND_DISTANCE_WEEK_RATIO:
        #     score = 0
        # else:
        #     # 弱~強の範囲を0~1に正規化
        #     score = (height_and_distance_ratio - HEIGHT_AND_DISTANCE_WEEK_RATIO) / (HEIGHT_AND_DISTANCE_STRONG_RATIO - HEIGHT_AND_DISTANCE_WEEK_RATIO)
        return score_distance

    series = gdf.apply(func, axis=1)
    return series
