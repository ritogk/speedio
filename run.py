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
            result = {
                'start': {'lat': coords[i - 1][1], 'lng': coords[i - 1][0]},
                'center': {'lat': coords[i][1], 'lng': coords[i][0]},
                'end': {'lat': coords[i + 1][1], 'lng': coords[i + 1][0]},
                'angle': angle,
                'horizontalVector': direction
            }
            results.append(result)
        return results

    series = gdf.apply(func, axis=1)

    print(series.to_list()[0])
    # matplotlibを使用して描画
    fig, ax = plt.subplots()
    gpd.GeoSeries(first_geometry).plot(ax=ax)
    ax.set_title("First Geometry Plot")
    plt.show()

    return gdf


run()
