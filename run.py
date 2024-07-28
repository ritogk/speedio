from src.main import main

import geopandas as gpd
import matplotlib.pyplot as plt
from pprint import pprint
from src.analysis.column_generater_module.core.calculate_angle_between_vectors import calculate_angle_between_vectors
from geopy.distance import geodesic
from src.core.env import getEnv

import numpy as np

def run():
    gdf = main()
    env = getEnv()

    if env["SHOW_HIGH_EVALUATION"]:
        # 先頭のdataframeをセットする
        first_geometry = gdf.iloc[0].geometry
        datas = gdf.iloc[0].corners
        
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
            if data['angle'] < 61:
                continue
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
