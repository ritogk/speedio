import geopandas as gpd
import shapely
import pandas as pd
import numpy as np
import math
import matplotlib.pyplot as plt

# (optional) Added to avoid high CPU usage while using colab
import warnings

warnings.simplefilter(action="ignore", category=FutureWarning)

# 座標系を緯度経度から平面直角座標系に変換
road_center = gpd.read_file("./roadCenter.geojson")
road_center_proj = road_center.to_crs("EPSG:6677")
road_edge = gpd.read_file("./roadEdge_clipped.geojson")
road_edge_proj = road_edge.to_crs("EPSG:6677")


# 個々のセグメントを取り出す
def get_segments(line_string):
    starts = line_string.coords[:-1]
    ends = line_string.coords[1:]
    return list(zip(starts, ends))


# 線分ごとに長さを求める
def get_lengths(segments):
    result = []
    for segment in segments:
        src = segment[0]
        dst = segment[1]
        dx = dst[0] - src[0]
        dy = dst[1] - src[1]
        result.append(np.sqrt(dx * dx + dy * dy))
    return result


# 線分ごとに法線を求める
def get_normals(segments):
    result = []
    for segment in segments:
        src = segment[0]
        dst = segment[1]
        dx = dst[0] - src[0]
        dy = dst[1] - src[1]
        len = np.sqrt(dx * dx + dy * dy)
        normal = np.array([-dy, dx]) / len
        result.append(normal)
    return result


# 端からある長さ at_length の座標を求める
def get_point_at_length(cumulative_lengths, segments, lengths, at_length):
    length = cumulative_lengths[-1]
    if at_length < 0 or at_length > length:
        return np.nan
    index = np.searchsorted(cumulative_lengths, at_length, side="left")
    segment_end_length = cumulative_lengths[index]
    segment_length = lengths[index]
    segment = segments[index]
    overrun = segment_end_length - at_length
    overrun_dx = (segment[1][0] - segment[0][0]) * overrun / segment_length
    overrun_dy = (segment[1][1] - segment[0][1]) * overrun / segment_length
    return np.array([segment[1][0] - overrun_dx, segment[1][1] - overrun_dy])


# 端からある長さ at_length での法線を求める
def get_normal_at_length(cumulative_lengths, normals, at_length):
    length = cumulative_lengths[-1]
    # outside curve
    if at_length < 0 or at_length > length:
        return np.nan
    # find line segment
    index = np.searchsorted(cumulative_lengths, at_length, side="left")
    return normals[index]


### 端から一定間隔で法線と座標を求める
def evaluate_by_interval(line_string, interval=1.0):
    length = line_string.length
    n_points = math.floor(length / interval)
    parameters = np.arange(0, length, interval)

    segments = get_segments(line_string)
    lengths = get_lengths(segments)
    cumulative_lengths = np.cumsum(lengths)
    normals = get_normals(segments)

    getP = np.vectorize(
        lambda x: get_point_at_length(cumulative_lengths, segments, lengths, x),
        signature="()->(i)",
    )
    getN = np.vectorize(
        lambda x: get_normal_at_length(cumulative_lengths, normals, x),
        signature="()->(i)",
    )

    return {
        "curve_parameters": parameters,
        "points": getP(parameters),
        "normals": getN(parameters),
    }


### 線データの上に等間隔に点を発生させる
def sample_line_string(df, id_column="rID", interval=1):
    tmp = df[["geometry"]].apply(
        lambda x: evaluate_by_interval(x["geometry"], interval),
        axis=1,
        result_type="expand",
    )
    tmp["rID"] = df["rID"]
    tmp = tmp.set_index(["rID"]).apply(pd.Series.explode).reset_index()
    return tmp


sampled_points = sample_line_string(road_center_proj)

road_edge_union = road_edge_proj["geometry"].unary_union
ray_length = 20


def compute_half_road_width(shape, point, normal, ray_length, invert_normal=False):
    if invert_normal:
        normal = normal * -1
    src = point
    dst = point + normal * ray_length
    ray = shapely.geometry.LineString([src, dst])
    intersection = ray.intersection(shape)
    if intersection.is_empty:
        return np.nan
    coords = (
        gpd.GeoSeries([intersection])
        .explode()
        .apply(lambda x: x.coords)
        .explode()
        .reset_index(drop=True)
    )
    sortable = (
        coords.apply(lambda x: x[0] - point[0])
        if normal[0] > 0.7
        else coords.apply(lambda x: x[1] - point[1])
    )
    abs_sortable = np.abs(sortable.values)
    argmin = np.argmin(abs_sortable)
    coord = coords[argmin]
    distance = np.sqrt((coord[0] - point[0]) ** 2 + (coord[1] - point[1]) ** 2)
    return distance


half_road_width_positive_side = sampled_points[["points", "normals"]].apply(
    lambda x: compute_half_road_width(
        road_edge_union, x["points"], x["normals"], ray_length, invert_normal=False
    ),
    axis=1,
)

half_road_width_negative_side = sampled_points[["points", "normals"]].apply(
    lambda x: compute_half_road_width(
        road_edge_union, x["points"], x["normals"], ray_length, invert_normal=True
    ),
    axis=1,
)

road_width_values = half_road_width_positive_side + half_road_width_negative_side
road_widths_at_points = sampled_points.copy()
road_widths_at_points["raytraced_width"] = road_width_values
road_widths = (
    road_widths_at_points[["rID", "raytraced_width"]].groupby(["rID"]).median()
)

road_center_with_width = pd.merge(
    road_center_proj, road_widths, left_on="rID", right_on="rID"
)

# Buffer road center line for sanity check
road_center_nona = road_center_with_width.dropna(subset=["raytraced_width"])
road_center_buffered = road_center_nona.apply(
    lambda x: x["geometry"].buffer(x["raytraced_width"] / 2), axis=1
)

fig, ax = plt.subplots(figsize=(12, 12))
gpd.GeoDataFrame({"geometry": road_center_buffered}).plot(ax=ax, color="#aaa")
road_edge_proj.plot(ax=ax)
road_center_with_width.plot(ax=ax, column="raytraced_width")
