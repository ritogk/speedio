from geopandas import GeoDataFrame
from pandas import Series
from geopy.distance import geodesic

def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        line = row.geometry
        elevations = row.elevation

        slope_per_meter_list = []

        # print("★★★★★★")
        # print(elevations)

        # print(f'distance, elevation_diff, slope_per_meter, point')
        ratio = 0.2
        for index, point in enumerate(line.coords):
            elevation = elevations[index]
            if index + 1 < len(line.coords):
                next_point = line.coords[index + 1]
                next_point_elevation = elevations[index + 1]
                distance = geodesic((point[1], point[0]), (next_point[1], next_point[0])).meters
                elevation_diff = abs(elevation - next_point_elevation)
                slope_per_meter = elevation_diff / distance
                slope_per_meter_list.append(slope_per_meter)

                if slope_per_meter > ratio:
                    if elevation < next_point_elevation:
                        adjust_next_elevation = elevation + (distance * ratio)
                    else:
                        adjust_next_elevation = elevation - (distance * ratio)
                        if adjust_next_elevation < 0:
                            adjust_next_elevation = 0
                    elevations[index + 1] = adjust_next_elevation

                # print(f'{distance},{elevation_diff},{slope_per_meter},{point}')
        # print('★★★★★★')
        # print(elevations)
        return elevations

    series = gdf.apply(func, axis=1)
    return series