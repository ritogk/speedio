from src.main import main

import geopandas as gpd
import matplotlib.pyplot as plt
from src.core.env import getEnv
from src.analysis.column_generater_module.score_road_section import WEEK_CORNER_ANGLE_MIN, WEEK_CORNER_ANGLE_MAX, MEDIUM_CORNER_ANGLE_MIN, MEDIUM_CORNER_ANGLE_MAX, STRONG_CORNER_ANGLE_MIN
import itertools

def run():
    gdf = main()
    env = getEnv()

    if env["SHOW_CORNER"]:
        # 先頭のdataframeをセットする
        gdf_first = gdf.iloc[0]

        corners = gdf_first.road_section

        week_corner = [item for item in corners if
                       (WEEK_CORNER_ANGLE_MIN <= item['adjusted_steering_angle'] < WEEK_CORNER_ANGLE_MAX)]
        medium_corner = [item for item in corners if
                       (MEDIUM_CORNER_ANGLE_MIN <= item['adjusted_steering_angle'] < MEDIUM_CORNER_ANGLE_MAX)]
        strong_corner = [item for item in corners if
                          STRONG_CORNER_ANGLE_MIN <= item['adjusted_steering_angle']]

         # プロットの準備
        fig, ax = plt.subplots()
        gpd.GeoSeries(gdf_first.geometry).plot(ax=ax, color='gray')

        
        medium_coords = list(dict.fromkeys(itertools.chain(*[item['points'] for item in medium_corner])))
        strong_coords = list(dict.fromkeys(itertools.chain(*[item['points'] for item in strong_corner])))
        
        if week_corner:
            week_coords = list(dict.fromkeys(itertools.chain(*[item['points'] for item in week_corner])))
            ax.scatter(*zip(*week_coords), color='blue', label='week', s=10)
        if medium_corner:
            medium_coords = list(dict.fromkeys(itertools.chain(*[item['points'] for item in medium_corner])))
            ax.scatter(*zip(*medium_coords), color='green', label='medium', s=10)
        if strong_corner:
            strong_coords = list(dict.fromkeys(itertools.chain(*[item['points'] for item in strong_corner])))
            ax.scatter(*zip(*strong_coords), color='red', label='strong', s=10)
        
        week_corner_distance = sum(
            item['distance'] for item in corners
            if (WEEK_CORNER_ANGLE_MIN <= item['adjusted_steering_angle'] < WEEK_CORNER_ANGLE_MAX)
        )
        medium_corner_distance = sum(
            item['distance'] for item in corners
            if (MEDIUM_CORNER_ANGLE_MIN <= item['adjusted_steering_angle'] < MEDIUM_CORNER_ANGLE_MAX)
        )
        strong_corner_distance = sum(
            item['distance'] for item in corners
            if STRONG_CORNER_ANGLE_MIN <= item['adjusted_steering_angle']
        )
        print(f"week: {week_corner_distance}m, medium: {medium_corner_distance}m, strong: {strong_corner_distance}m")
        print(f"all: {gdf_first.length}m")


        plt.legend()
        plt.show()
    return gdf


run()
