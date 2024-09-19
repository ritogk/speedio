from geopandas import GeoDataFrame
from pandas import Series
from shapely.geometry import LineString, Point
from geopy.distance import geodesic
from enum import Enum

# 標高のU字型の特徴量を求める
# = (標高の増加の総和と標高の減少の総和の比率 ) * (標高の増加の総和 + 標高の減少の総和)
INTERVAL = 100
class SectionType(Enum):
    UP = 'up'
    DOWN = 'down'
    FLAT = 'flat'
flat_elevation_avg = 0.4

HEIGHT_AND_DISTANCE_STRONG_RATIO = 0.07
HEIGHT_AND_DISTANCE_MEDIUM_RATIO = 0.035
HEIGHT_AND_DISTANCE_WEEK_RATIO = 0.015
class SectionTypeLevel(Enum):
    HIGHT = 3
    MEDIUM = 2
    LOW = 1

def generate(gdf: GeoDataFrame) -> tuple[Series, Series]:
    def func(row):
        segment_list = interpolate_point_index_list(row.geometry, INTERVAL, row.length)
        # print(segment_list)

        coords = list(row.geometry.coords)
        elevations = row.elevation_smooth
        # print(len(coords))
        # print(len(elevations))
        # print(segment_list)


        elevation_section = []
        for i, segment_index in enumerate(segment_list[:-1]):
            # print(i, segment_index)
            distance = segment_list[i + 1]['distance']
            st_index = segment_index['index']
            ed_index = segment_list[i + 1]['index']
            # print(distance)
            # print(st_index)
            # print(ed_index)
            center_index = st_index + (ed_index - st_index) // 2
            st = elevations[st_index]
            center = elevations[center_index]
            ed = elevations[ed_index]

            # print(st_index, center_index, ed_index)

            # stからedまでの標高の平均を求める
            avg = sum(elevations[st_index:ed_index]) / (ed_index - st_index)

            # 3つの標高の最小値を見つける
            min_elevation = min(st, center, ed)

            # それぞれの標高から最小値を引いて0以上にスケール
            st_scaled = st - min_elevation
            center_scaled = center - min_elevation
            ed_scaled = ed - min_elevation

            # stからedまでの標高の平均を求める（スケール済み）
            avg_scaled = (st_scaled + ed_scaled) / 2

            # 高さを求める
            height = max(st, center, ed) - min_elevation

            section_type = SectionType.FLAT.value
            if avg_scaled > flat_elevation_avg:
                temp = st_scaled - center_scaled - ed_scaled
                if temp < 0:
                    section_type = SectionType.UP.value
                elif temp > 0:
                    section_type = SectionType.DOWN.value

            section_type_level = calc_section_level(distance, height)

            elevation_section.append({
                "p_st": [coords[st_index][1], coords[st_index][0]],
                "p_center": [coords[center_index][1], coords[center_index][0]],
                "p_ed": [coords[ed_index][1], coords[ed_index][0]],
                "e_st": st_scaled,
                "e_center": center_scaled,
                "e_ed": ed_scaled,
                "e_avg": avg_scaled,
                "section_type": section_type,
                "distance": distance,
                "e_height": height,
                "section_type_level": section_type_level
            })
        # elevation_sectionをa_typeが変わる毎にグループ化する
        old_section_type = elevation_section[0]["section_type"]
        section_work = {"section_type": old_section_type,
                        "height": elevation_section[0]["e_height"], # 後で変更する
                        "distance": elevation_section[0]["distance"], # 後で変更する
                        "section_type_level": elevation_section[0]["section_type_level"], # 後で変更する
                        "info": [elevation_section[0]]}
        elevation_group = []
        for i, section in enumerate(elevation_section[1:], start=1):
            section_type = section["section_type"]
            if old_section_type != section_type:
                # infoのdistanceを合計する
                section_work["height"] = sum([info["e_height"] for info in section_work["info"]])
                section_work["distance"] = sum([info["distance"] for info in section_work["info"]])
                section_work["section_type_level"] = calc_section_level(section_work["distance"], section_work["height"])
                elevation_group.append(section_work)

                section_work = {
                    "section_type": section_type,
                    "height": section["e_height"],
                    "distance": section["distance"],
                    "section_type_level": section["section_type_level"],
                    "info": [section]
                }
                old_section_type = section_type
            else:
                section_work["info"].append(section)
        if len(section_work["info"]) >= 1:
            section_work["height"] = sum([info["e_height"] for info in section_work["info"]])
            section_work["distance"] = sum([info["distance"] for info in section_work["info"]])
            section_work["section_type_level"] = calc_section_level(section_work["distance"], section_work["height"])
            elevation_group.append(section_work)
        
        return elevation_group, elevation_section

    results = gdf.apply(func, axis=1, result_type='expand')

    # 'elevation_group'と'elevation_section'を2つに分ける
    elevation_group = results[0]
    elevation_section = results[1]

    return elevation_group, elevation_section


def interpolate_point_index_list(line: LineString, interval: int, length:int) -> list[list[Point, Point]]:
    point_indexs = [{"index": 0, "distance": 0}]
    distance = 0
    old_point = line.coords[0]
    for index, point in enumerate(line.coords):
        # x, y = point
        if index + 1 >= len(line.coords):
            if distance != 0:
                point_indexs.append({"index": len(line.coords) - 1, "distance": distance})
            continue
        next_point = line.coords[index + 1]
        distance += geodesic((point[1], point[0]), (next_point[1], next_point[0])).meters
        if distance >= interval:
            # print(old_point)
            # print(next_point)
            # print(distance)
            point_indexs.append({"index": index + 1, "distance": distance})
            distance = 0
            old_point = next_point

    # print(point_indexs)
    return point_indexs

def calc_section_level(distance: int, height: int) -> float:
    section_type_level = SectionTypeLevel.LOW.value
    height_and_distance_ratio = height / distance
    # print(height_and_distance_ratio)
    if height_and_distance_ratio >= HEIGHT_AND_DISTANCE_STRONG_RATIO:
        section_type_level = SectionTypeLevel.HIGHT.value
    elif height_and_distance_ratio >= HEIGHT_AND_DISTANCE_MEDIUM_RATIO:
        section_type_level = SectionTypeLevel.MEDIUM.value
    else:
        section_type_level = SectionTypeLevel.LOW.value
    return section_type_level