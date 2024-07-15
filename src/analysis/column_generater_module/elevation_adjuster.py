from geopandas import GeoDataFrame
from pandas import Series
from geopy.distance import geodesic

# 国土地理院の標高モデルはレーザー計測でそこから建物の高さを引いたものを標高値としている。
# https://www.gsi.go.jp/KIDS/KIDS16.html#:~:text=%E8%88%AA%E7%A9%BA%E3%83%AC%E3%83%BC%E3%82%B6%E6%B8%AC%E9%87%8F%E3%81%AF%E3%80%81%20%E8%88%AA%E7%A9%BA%E6%A9%9F,%E6%A8%99%E9%AB%98%E3%82%92%E5%87%BA%E3%81%97%E3%81%A6%E3%81%84%E3%81%BE%E3%81%99%E3%80%82
# 道路の標高が計測されている所もあればさえていない所もある。
# 橋、トンネルの区間なら調整可能だが、調整可能な目印がない場合もありこの処理はその道を調整するためのもの。
# 道路の勾配は、国の道路構造令により全国一律で「最大12％」100m進むと12m上がる傾斜が最大。
# 長崎県は最大17％.
# https://trafficnews.jp/post/122278

# とりあえず20%にしておく。
METER_AND_ELEVATION_RATIO = 0.2
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        line = row.geometry
        elevations = row.elevation

        slope_per_meter_list = []
        # print(f'distance, elevation_diff, slope_per_meter, point')
        METER_AND_ELEVATION_RATIO = 0.2
        for index, point in enumerate(line.coords):
            elevation = elevations[index]
            if index + 1 < len(line.coords):
                next_point = line.coords[index + 1]
                next_point_elevation = elevations[index + 1]
                distance = geodesic((point[1], point[0]), (next_point[1], next_point[0])).meters
                elevation_diff = abs(elevation - next_point_elevation)
                slope_per_meter = elevation_diff / distance
                slope_per_meter_list.append(slope_per_meter)

                if slope_per_meter > METER_AND_ELEVATION_RATIO:
                    if elevation < next_point_elevation:
                        adjust_next_elevation = elevation + (distance * METER_AND_ELEVATION_RATIO)
                    else:
                        adjust_next_elevation = elevation - (distance * METER_AND_ELEVATION_RATIO)
                        if adjust_next_elevation < 0:
                            adjust_next_elevation = 0
                    elevations[index + 1] = adjust_next_elevation

                # print(f'{distance},{elevation_diff},{slope_per_meter},{point}')
        return elevations

    series = gdf.apply(func, axis=1)
    return series