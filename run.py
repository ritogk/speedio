from src.main import main

import geopandas as gpd
import matplotlib.pyplot as plt

from src.analysis.column_generater_module.core.calculate_angle_between_vectors import calculate_angle_between_vectors

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
    
    # turnの始点と最大角度の座標と終点の間の角度を求める。
    for turn in turns:
        max_angle = 0
        max_angle_point = max(turn, key=lambda x: x['angle'])
        # ここでmに変換する必要はなにのか・・？
        angle, direction = calculate_angle_between_vectors(
                (turn[0]['start']['lng'], turn[0]['start']['lat']),
                (max_angle_point['center']['lng'], max_angle_point['center']['lat']),
                (turn[-1]['end']['lng'], turn[-1]['end']['lat'])
            )
        print(angle, direction, (max_angle_point['center']['lng'], max_angle_point['center']['lat']))

    # print(turns)
    # matplotlibを使用して描画
    fig, ax = plt.subplots()
    gpd.GeoSeries(first_geometry).plot(ax=ax)
    ax.set_title("First Geometry Plot")
    plt.show()

    return gdf


run()
