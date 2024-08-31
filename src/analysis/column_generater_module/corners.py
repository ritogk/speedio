from geopandas import GeoDataFrame
from pandas import Series
from src.analysis.column_generater_module.core.calculate_angle_between_vectors import calculate_angle_between_vectors
from geopy.distance import geodesic
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        # ステアリングの方向が変わる毎にグループ化
        target = row['steering_wheel_angle_info']
        old_direction = target[0]['direction']
        corners = []
        corner = [target[0]]
        for i in range(1, len(target)):
            if target[i]['direction'] == old_direction:
                corner.append(target[i])
            else:
                corners.append(corner)
                corner = [target[i]]
                old_direction = target[i]['direction']
        corners.append(corner)
        
        datas = []
        for corner in corners:
            max_steering_angle = max(corner, key=lambda x: x['steering_angle'])['steering_angle']
            avg_steering_angle = sum([x['steering_angle'] for x in corner]) / len(corner)
            # コーナー内の座標をつなげる。
            points = []
            for one_corner in corner:
                points.append(one_corner['start'])
                points.append(one_corner['center'])
                points.append(one_corner['end'])
            # 並び順を維持したまま重複を削除
            points = list(dict.fromkeys(points))
            # pointsから距離(m)を計算
            distance = 0
            for i in range(len(points) - 1):
                distance += geodesic(reversed(points[i]), reversed(points[i+1])).meters
            datas.append({
                'max_steering_angle': max_steering_angle,
                'avg_steering_angle': avg_steering_angle,
                'steering_direction': corner[0]['direction'],
                'points': points,
                'corner_info': corner,
                'distance': distance,
            })

        return datas

    series = gdf.apply(func, axis=1)

    return series
