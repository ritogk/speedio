from geopandas import GeoDataFrame, GeoSeries
from pandas import Series


# 10~100の範囲でコーナーをグループ化する
def generate(gdf: GeoDataFrame) -> Series:
    def func(row: GeoSeries):
        corners = row['road_section']
        corner_groups = {'10': [], '20': [], '30': [], '40': [], '50': [], '60': [], '70': [], '80': [], '90': [], '100': []}
        for corner in corners:
            adjusted_steering_angle = corner['adjusted_steering_angle']
            if adjusted_steering_angle <= 10:
                corner_groups['10'].append(corner)
            elif adjusted_steering_angle <= 20:
                corner_groups['20'].append(corner)
            elif adjusted_steering_angle <= 30:
                corner_groups['30'].append(corner)
            elif adjusted_steering_angle <= 40:
                corner_groups['40'].append(corner)
            elif adjusted_steering_angle <= 50:
                corner_groups['50'].append(corner)
            elif adjusted_steering_angle <= 60:
                corner_groups['60'].append(corner)
            elif adjusted_steering_angle <= 70:
                corner_groups['70'].append(corner)
            elif adjusted_steering_angle <= 80:
                corner_groups['80'].append(corner)
            elif adjusted_steering_angle <= 90:
                corner_groups['90'].append(corner)
            else:
                corner_groups['100'].append(corner)
        return corner_groups
    series = gdf.apply(func, axis=1)
    return series
