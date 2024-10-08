from src.main import main

import geopandas as gpd
import matplotlib.pyplot as plt
from src.core.env import getEnv
from src.analysis.column_generater_module.score_corner_level import WEEK_CORNER_ANGLE_MIN, WEEK_CORNER_ANGLE_MAX, MEDIUM_CORNER_ANGLE_MIN, MEDIUM_CORNER_ANGLE_MAX, STRONG_CORNER_ANGLE_MIN

def run():
    gdf = main()
    env = getEnv()

    if env["SHOW_CORNER"]:
        # 先頭のdataframeをセットする
        gdf_first = gdf.iloc[0]

        road_section = gdf_first.road_section

        week_corner = [item for item in road_section
                       if
                        (WEEK_CORNER_ANGLE_MIN <= item['adjusted_steering_angle'] < WEEK_CORNER_ANGLE_MAX)
                        and item['section_type'] != 'straight']
        medium_corner = [item for item in road_section if
                       (MEDIUM_CORNER_ANGLE_MIN <= item['adjusted_steering_angle'] < MEDIUM_CORNER_ANGLE_MAX)
                       and item['section_type'] != 'straight']
        strong_corner = [item for item in road_section if
                          STRONG_CORNER_ANGLE_MIN <= item['adjusted_steering_angle']
                          and item['section_type'] != 'straight']
        none_corner = [item for item in road_section if
                            item['section_type'] == 'straight']

         # プロットの準備
        fig, ax = plt.subplots()
        gpd.GeoSeries(gdf_first.geometry).plot(ax=ax, color='gray')
        week_sections = [item['points'] for item in week_corner]
        medium_sections = [item['points'] for item in medium_corner]
        strong_sections = [item['points'] for item in strong_corner]
        none_sections = [item['points'] for item in none_corner]
        
        if week_sections:
            ax.plot([], [], color="orange", label='week')
            for section in week_sections:
                ax.plot(*zip(*section), color="orange", linewidth=2)
        if medium_sections:
            ax.plot([], [], color="green", label='medium')
            for section in medium_sections:
                ax.plot(*zip(*section), color="green", linewidth=2)
        if strong_sections:
            ax.plot([], [], color="red", label='strong')
            for section in strong_sections:
                ax.plot(*zip(*section), color="red", linewidth=2)
        if none_sections:
            ax.plot([], [], color="lightgray", label='none')
            for section in none_sections:
                ax.plot(*zip(*section), color="lightgray", linewidth=1)
        
        week_corner_distance = sum(
            item['distance'] for item in road_section
            if (WEEK_CORNER_ANGLE_MIN <= item['adjusted_steering_angle'] < WEEK_CORNER_ANGLE_MAX)
            and item['section_type'] != 'straight'
        )
        medium_corner_distance = sum(
            item['distance'] for item in road_section
            if (MEDIUM_CORNER_ANGLE_MIN <= item['adjusted_steering_angle'] < MEDIUM_CORNER_ANGLE_MAX)
            and item['section_type'] != 'straight'
        )
        strong_corner_distance = sum(
            item['distance'] for item in road_section
            if STRONG_CORNER_ANGLE_MIN <= item['adjusted_steering_angle']
            and item['section_type'] != 'straight'
        )
        none_corner_distance = sum(
            item['distance'] for item in road_section
            if item['section_type'] == 'straight'
        )
        # print(f"length: {gdf_first.length}")
        # print(f"week: {week_corner_distance}m, medium: {medium_corner_distance}m, strong: {strong_corner_distance}m, none: {none_corner_distance}m")
        # print(f"all: {gdf_first.length}m")

        # for item in road_section:
        #     if item['section_type'] == 'straight':
        #         print(f"distance: {item['distance']}m, type: {item['section_type']}, angle: {item['adjusted_steering_angle']}")


        plt.legend()
        plt.show()
    return gdf


run()
