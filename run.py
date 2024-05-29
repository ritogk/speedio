from src.main import main

import geopandas as gpd
import matplotlib.pyplot as plt
from pprint import pprint
from src.analysis.column_generater_module.core.calculate_angle_between_vectors import calculate_angle_between_vectors
from geopy.distance import geodesic

def run():
    gdf = main()
    # 1行目のgeometryをグラフに表示
    # 'geometry'列の1行目を選択

    # 先頭のdataframeをセットする
    first_geometry = gdf.iloc[0].geometry

    # angle_deltas.pyを参考する
    # geometryから3座標間の角度を計算する.

    # 最終的に欲しいデータ形式はこれ。
    # {start:{lat, lng}, center: {lat, lng}, end: {lat, lng}, angle: 50, horizontalVector: "left"}

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
        return filtered_results

    series = gdf.apply(func, axis=1)

    target = series.to_list()[0]
    # 曲がり角毎にまとめる。
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
        # print('turn:')
        # print(turn)
        # print('distance: ')
        # print(distance)

        # print(angle, direction, (max_angle_point['center']['lng'], max_angle_point['center']['lat']))
        # print('turn: ')
        # print(turn)
    
    print(datas)
    
    # matplotlibを使用して描画
    fig, ax = plt.subplots()
    
    # first_geometryを背面に表示
    gpd.GeoSeries(first_geometry).plot(ax=ax, color='black', alpha=0.01)
    
     # カラーマップと正規化
    cmap_right = plt.get_cmap('Reds')
    cmap_left = plt.get_cmap('Blues')
    norm = plt.Normalize(vmin=min(data['angle'] for data in datas),
                         vmax=max(data['angle'] for data in datas))

    # turnsのpointsを表示する
    for data in datas:
        points = data['points']
        if data['direction'] == 'right':
            color = cmap_right(norm(data['angle']))
        elif data['direction'] == 'left':
            color = cmap_left(norm(data['angle']))
        else:
            color = 'grey'  # その他の方向の場合はグレー
        lat, lng = zip(*[(point['lat'], point['lng']) for point in points])
        ax.plot(lng, lat, color=color, linewidth=2)  # sはマーカーのサイズ

    plt.colorbar(plt.cm.ScalarMappable(norm=norm, cmap=cmap_right), ax=ax, label='Angle (degrees)')
    plt.show()

    return gdf


run()
