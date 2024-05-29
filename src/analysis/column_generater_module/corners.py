from geopandas import GeoDataFrame
from pandas import Series
from src.analysis.column_generater_module.core.calculate_angle_between_vectors import calculate_angle_between_vectors
from geopy.distance import geodesic
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        coords = row['geometry'].coords
        results = []
        for i in range(1, len(coords) - 1):
            angle, direction = calculate_angle_between_vectors(
                coords[i - 1], coords[i], coords[i + 1]
            )
            ## ここstartとかendとかなくてもよいか・・・？
            result = {
                'start': {'lat': coords[i - 1][1], 'lng': coords[i - 1][0]},
                'center': {'lat': coords[i][1], 'lng': coords[i][0]},
                'end': {'lat': coords[i + 1][1], 'lng': coords[i + 1][0]},
                'angle': angle,
                'horizontalVector': direction
            }
            results.append(result)

        # 同angleのデータが3つ以上連続していないデータを削除する
        filtered_results = []
        count = 1
        for i in range(1, len(results)):
            if results[i]['horizontalVector'] == results[i - 1]['horizontalVector']:
                count += 1
            else:
                if count >= 3:
                    filtered_results.extend(results[i - count:i])
                count = 1
        # 最後のグループをチェック
        if count >= 3:
            filtered_results.extend(results[-count:])
        
        target = filtered_results
        turns = []
        old_horizontal_vector = target[0]['horizontalVector']
        turn = [target[0]]
        for i in range(1, len(target)):
            if target[i]['horizontalVector'] == old_horizontal_vector:
                turn.append(target[i])
            else:
                turns.append(turn)
                turn = [target[i]]
                old_horizontal_vector = target[i]['horizontalVector']
        turns.append(turn)

        
        datas = []
        for turn in turns:
            max_angle = 0
            # ★ここがおかしいような気がする。
            max_angle_point = max(turn, key=lambda x: x['angle'])
            # print(max_angle_point['center'])
            # turnの始点と最大角度の座標と終点の間の角度を求める。
            angle_abc, direction_abc = calculate_angle_between_vectors(
                    (turn[0]['start']['lng'], turn[0]['start']['lat']),
                    (max_angle_point['center']['lng'], max_angle_point['center']['lat']),
                    (turn[-1]['end']['lng'], turn[-1]['end']['lat'])
                )
            if max_angle_point['center'] == {'lat': 35.3799484, 'lng': 136.9993582}:
                print(angle_abc, direction_abc)
                print(turn[0]['start']['lng'], turn[0]['start']['lat'])
                print(max_angle_point['center']['lng'], max_angle_point['center']['lat'])
                print(turn[-1]['end']['lng'], turn[-1]['end']['lat'])
            # 角度用の座標から１コーナーのpointsを作成
            points = []
            for angle in turn:
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
        return datas

    series = gdf.apply(func, axis=1)

    return series
