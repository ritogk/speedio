from geopandas import GeoDataFrame
from pandas import Series
from .elevation_u_shape import SectionType, SectionTypeLevel



def generate(gdf: GeoDataFrame) -> tuple[Series, Series, Series, Series, Series]:
    def func(x):
        elevation_group = x.elevation_group
        
        up_section_distance = 0
        up_section_level = 0
        score_up_section = 0
        up_group_list = [item for item in elevation_group if (item['section_type'] == SectionType.UP.value)]
        if not len(up_group_list) == 0:
            up_section_distance = sum(item['distance'] for item in up_group_list)
            up_section_level = sum(item['section_type_level'] for item in up_group_list) / len(up_group_list)
            # score_up_section = ((up_section_distance / x.length) * up_section_level) / ((up_section_distance / x.length) * SectionTypeLevel.HIGHT.value)
            score_up_section = (up_section_distance / x.length) * up_section_level
            # score_up_section = 1.0 if score_up_section > 1.0 else score_up_section

        # print(up_section_distance, up_section_level, score_up_section)
        down_section_distance = 0
        down_section_level = 0
        score_down_section = 0
        down_group_list = [item for item in elevation_group if (item['section_type'] == SectionType.DOWN.value)]
        if not len(down_group_list) == 0:
            down_section_distance = sum(item['distance'] for item in down_group_list)
            down_section_level = sum(item['section_type_level'] for item in down_group_list) / len(down_group_list)
            # score_down_section = (down_section_distance / x.length) * down_section_level) / ((down_section_distance / x.length) * SectionTypeLevel.HIGHT.value)
            score_down_section = (down_section_distance / x.length) * down_section_level
            # score_down_section = 1.0 if score_down_section > 1.0 else score_down_section

        # print(down_section_distance, down_section_level, score_down_section)
        flat_section_distance = 0
        flat_section_level = 0
        score_flat_section = 0
        flat_group_list = [item for item in elevation_group if (item['section_type'] == SectionType.FLAT.value)]
        if not len(flat_group_list) == 0:
            flat_section_distance = sum(item['distance'] for item in flat_group_list)
            flat_section_level = sum(item['section_type_level'] for item in flat_group_list) / len(flat_group_list)
            # score_flat_section = ((flat_section_distance / x.length) * flat_section_level) / ((flat_section_distance / x.length) * SectionTypeLevel.HIGHT.value)
            score_flat_section = flat_section_distance / x.length
            # score_flat_section = 1.0 if score_flat_section > 1.0 else score_flat_section
        
        # if score_up_section == 0 or score_down_section == 0 or score_flat_section == 0:
        if score_up_section == 0 or score_down_section == 0:
            score_deviation = 0
        else:
            min_score = min([score_up_section, score_down_section])
            max_score = max([score_up_section, score_down_section])
            score_deviation = min_score / max_score
        
        score_complexity = len(elevation_group) / len(x.elevation_section)

        return score_up_section, score_down_section, score_flat_section, score_deviation, score_complexity

    results = gdf.apply(func, axis=1, result_type='expand')
    score_up_section = results[0]
    score_down_section = results[1]
    score_flat_section = results[2]
    score_deviation_section = results[3]
    score_complexity = results[4]
    return score_up_section, score_down_section, score_flat_section, score_deviation_section, score_complexity
