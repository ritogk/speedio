from geopandas import GeoDataFrame
from pandas import Series
from src.analysis.column_generater_module.core.calculate_angle_between_vectors import calculate_angle_between_vectors
from geopy.distance import geodesic
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        coords = row['geometry'].coords
        # 3点の座標から角度とベクトル(左右)を計算
        results = []
        for i in range(1, len(coords) - 1):
            angle, direction = calculate_angle_between_vectors(
                coords[i - 1], coords[i], coords[i + 1]
            )
            result = {
                'start': {'lat': coords[i - 1][1], 'lng': coords[i - 1][0]},
                'center': {'lat': coords[i][1], 'lng': coords[i][0]},
                'end': {'lat': coords[i + 1][1], 'lng': coords[i + 1][0]},
                'angle': angle,
                'horizontalVector': direction
            }
            results.append(result)
        
        # 先頭からベクトル毎にグループ化
        target = results
        corners = []
        old_horizontal_vector = target[0]['horizontalVector']
        corner = [target[0]]
        for i in range(1, len(target)):
            if target[i]['horizontalVector'] == old_horizontal_vector:
                corner.append(target[i])
            else:
                corners.append(corner)
                corner = [target[i]]
                old_horizontal_vector = target[i]['horizontalVector']
        corners.append(corner)
        
        datas = []
        for corner in corners:
            max_angle_point = max(corner, key=lambda x: x['angle'])

            # cornerの「始点」と「最大角度の座標」と「終点」間の角度を求める。
            angle_abc, direction_abc = calculate_angle_between_vectors(
                    (corner[0]['start']['lng'], corner[0]['start']['lat']),
                    (max_angle_point['center']['lng'], max_angle_point['center']['lat']),
                    (corner[-1]['end']['lng'], corner[-1]['end']['lat'])
                )
            # コーナー内の座標をつなげる。
            points = []
            for angle in corner:
                points.append(angle['start'])
                points.append(angle['center'])
                points.append(angle['end'])
            # points内の重複値を削除
            points = list({(d['lat'], d['lng']): d for d in points}.values())
            
            # pointsから距離(m)を計算
            distance = 0
            for i in range(len(points) - 1):
                start = (points[i]['lat'], points[i]['lng'])
                end = (points[i+1]['lat'], points[i+1]['lng'])
                distance += geodesic(start, end).meters
            datas.append({
                'angle': angle_abc,
                'direction': direction_abc,
                'points': points,
                'distance': distance
            })

            # angleが25以下のデータを削除
            datas = [data for data in datas if data['angle'] > 20]
        return datas

    series = gdf.apply(func, axis=1)

    return series
