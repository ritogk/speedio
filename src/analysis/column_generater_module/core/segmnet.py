
from shapely.geometry import LineString, Point
from .linstring_to_polygon import create_vertical_polygon

# linestringから指定した間隔の点を生成する
def generate_segment_list(line: LineString, interval: int, length:int) -> list[Point]:
    # 全体の長さに基づいて、分割する区間数を計算
    num_intervals = int(length // interval) + 1
    
    # 距離に基づいてループ。次の座標までの距離を計算し、intervalに達しない場合
    segment_points = []
    for i in range(num_intervals):
        # 総距離に対する進捗割合
        ratio = i * interval / length
        if ratio > 1:
            ratio = 1
        interpolated_point = line.interpolate(ratio * line.length)
        segment_points.append(interpolated_point)
    return segment_points


# linestringから指定した間隔の点を生成してオリジナルの座標のindex番号を取得する
def generate_segment_original_index_list(line: LineString, interval: int, length:int) -> list[int]:
    point_indexs = []

    coords = list(line.coords)
    
    # 指定間隔の座標を作成
    segment_points = generate_segment_list(line, interval, length)

    # 1. セグメントのポリゴンを作成 ※1
    # 2. そこに該当する座標を取得 ※2
    # 3. ※2に最も近い座標を取得
    for i in range(len(coords) - 1):
        point_st = coords[i]
        point_ed = coords[i + 1]
        target_line_coords = [point_st, point_ed]
        # 幅を1m増やしたポリゴンを作成
        polygon = create_vertical_polygon(target_line_coords, 1)
        # segment_pointsからポリゴン内の座標を取得
        polygon_in_segment_points = []
        for point in segment_points:
            if polygon.contains(point):
                polygon_in_segment_points.append(point)

        if len(polygon_in_segment_points) == 0:
            pass
        else:
            # 対象座標と始点と終点までの距離を測り最も近い座標のindex番号を取得
            point_st_p = Point(point_st)
            point_ed_p = Point(point_ed)
            for p in polygon_in_segment_points:
                distance_st = point_st_p.distance(p)
                distance_ed = point_ed_p.distance(p)
                if distance_st < distance_ed:
                    point_indexs.append(i)
                    # target.append({"index":i, "point":p})
                else:
                    point_indexs.append(i + 1)
                    # target.append({"index":i+1, "point":p})
    return point_indexs