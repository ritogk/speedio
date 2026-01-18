
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


from bisect import bisect_left
# linestringから指定した間隔の点を生成してオリジナルの座標のindex番号を取得する
def generate_segment_original_index_list(
    line: LineString, interval: int, length: int
) -> list[int]:
    coords = list(line.coords)
    if len(coords) == 0:
        return []

    # segment points（あなたの関数を使用）
    segment_points = generate_segment_list(line, interval, length)

    # 元頂点の「始点からの累積距離」を作る（chainage）
    chainages = [0.0]
    for i in range(1, len(coords)):
        chainages.append(chainages[-1] + LineString([coords[i-1], coords[i]]).length)

    # segment point -> 最近傍の頂点 index
    idxs = []
    for p in segment_points:
        # p が Point ならそのまま、tuple なら Point 化
        if not isinstance(p, Point):
            p = Point(p)

        s = line.project(p)  # 線の始点からの距離（同じ単位）

        j = bisect_left(chainages, s)
        if j <= 0:
            idxs.append(0)
        elif j >= len(chainages):
            idxs.append(len(chainages) - 1)
        else:
            # j-1 と j のどっちが近いか（同距離は前側優先）
            if (s - chainages[j-1]) <= (chainages[j] - s):
                idxs.append(j-1)
            else:
                idxs.append(j)

    return idxs