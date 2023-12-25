from .core import excution_timer
from .analysis import graph_feather
from .analysis import column_generater
from .analysis import remover
import osmnx as ox
from geopandas import GeoDataFrame
import os
import numpy as np

from geopy.distance import geodesic


def short_search() -> GeoDataFrame:
    # 自宅周辺の軽いデータ
    latitude_start = 35.330878
    longitude_start = 136.951774
    latitude_end = 35.402261
    longitude_end = 137.072889

    # latitude_start = 35.479240
    # longitude_start = 136.983065
    # latitude_end = 35.313280
    # longitude_end = 137.172579

    # # 自宅 ~ 豊橋方面
    # latitude_start = 35.371642
    # longitude_start = 136.967037
    # latitude_end = 34.833082
    # longitude_end = 137.672158

    excution_timer_ins = excution_timer.ExcutionTimer()

    excution_timer_ins.start("load openstreetmap data")
    graph = graph_feather.fetch_graph(
        latitude_start, longitude_start, latitude_end, longitude_end
    )
    excution_timer_ins.stop()

    excution_timer_ins.start("convert graph to GeoDataFrame")
    gdf_edges = ox.graph_to_gdfs(graph, nodes=False, edges=True)
    excution_timer_ins.stop()

    excution_timer_ins.start("remove reverse edge")
    gdf_edges = remover.reverse_edge.remove(gdf_edges)
    excution_timer_ins.stop()

    # 開始位置列を追加する
    excution_timer_ins.start("calc start_point")
    gdf_edges["start_point"] = column_generater.start_point.generate(gdf_edges)
    excution_timer_ins.stop()

    excution_timer_ins.start("calc end_point")
    gdf_edges["end_point"] = column_generater.end_point.generate(gdf_edges)
    excution_timer_ins.stop()

    # エッジ内のnodeから分岐数を取得する
    excution_timer_ins.start("calc connection_node_cnt")
    gdf_edges["connection_node_cnt"] = column_generater.connection_node_cnt.generate(
        gdf_edges, latitude_start, longitude_start, latitude_end, longitude_end
    )
    excution_timer_ins.stop()

    # 座標間の角度の変化量を求める
    excution_timer_ins.start("calc angle_change_amount")
    gdf_edges["angle_change_amount"] = column_generater.angle_change_amount.generate(
        gdf_edges
    )
    excution_timer_ins.stop()

    # 基準に満たないエッジを削除する
    excution_timer_ins.start("remove below standard edge")
    gdf_edges = remover.filter_edge.remove(gdf_edges)
    excution_timer_ins.stop()

    # 座標間の角度の変化量を求める
    excution_timer_ins.start("calc angle_change_amount")
    gdf_edges["angle_change_rate"] = (
        gdf_edges["angle_change_amount"] / gdf_edges["length"]
    )
    excution_timer_ins.stop()

    # 座標間の標高の変化量を求める
    excution_timer_ins.start("calc elevation_change_amount")
    gdf_edges[
        "elevation_change_amount"
    ] = column_generater.elevation_change_amount.generate(
        gdf_edges, "./merge-chubu-tokuriku-kanto3-tohoku.tif"
    )
    excution_timer_ins.stop()

    # 標高と距離の比率を求める
    excution_timer_ins.start("calc elevation_change_rate")
    gdf_edges["elevation_change_rate"] = (
        gdf_edges["elevation_change_amount"] / gdf_edges["length"]
    )
    excution_timer_ins.stop()

    # スコアを求める
    excution_timer_ins.start("calc score")
    gdf_edges["score"] = column_generater.score.generate(gdf_edges)
    excution_timer_ins.stop()

    # スコアが低いエッジを削除する
    excution_timer_ins.start("remoce low score edge")
    gdf_edges = remover.score.remove(gdf_edges)
    excution_timer_ins.stop()

    # スコアを正規化
    excution_timer_ins.start("calc score_nomalization")
    gdf_edges["score_normalization"] = column_generater.score_normalization.generate(
        gdf_edges
    )
    excution_timer_ins.stop()

    # 上位5件を取得する
    excution_timer_ins.start("get top 5")
    # gdf_edgesの上位5件を取得する
    gdf_edges = gdf_edges.sort_values("score_normalization", ascending=False).head(5)
    excution_timer_ins.stop()

    # google map urlを生成する
    excution_timer_ins.start("create google_map_url")
    gdf_edges["google_map_url"] = column_generater.google_map_url.generate(gdf_edges)
    excution_timer_ins.stop()

    # google earth urlを生成する
    excution_timer_ins.start("create google_earth_url")
    gdf_edges["google_earth_url"] = column_generater.google_earth_url.generate(
        gdf_edges
    )
    excution_timer_ins.stop()

    # street view urlを生成する
    excution_timer_ins.start("create street_view_url")
    gdf_edges["street_view_url"] = column_generater.street_view_url.generate(gdf_edges)
    excution_timer_ins.stop()

    # 上位5件を抽出する
    gdf_edges = gdf_edges.head(5)
    current_location = (35.352738, 136.922609)

    gdf_edges["center_point"] = gdf_edges["geometry"].apply(
        lambda x: x.coords[len(x.coords) // 2]
    )

    points = {"CURRENT": current_location}
    edges = {"CURRENT": [current_location, current_location]}
    cnt = 0
    for index, row in gdf_edges.iterrows():
        edge_name = chr(cnt + 65)
        cnt += 1
        # geometryの中央の値をtupleで取得する
        points[edge_name] = (row.center_point[1], row.center_point[0])

        # ["geometry"].apply(lambda x: x.coords[len(x.coords) // 2])

        # points[edge_name] = row.geometry.apply(lambda x: x.coords[-1])
        edges[edge_name] = [
            (row.start_point[1], row.start_point[0]),
            (row.end_point[1], row.end_point[0]),
        ]

    # Function to calculate the total distance of a route
    def calculate_route_distance(route):
        total_distance = 0
        for i in range(len(route) - 1):
            total_distance += geodesic(
                points[route[i]], points[route[i + 1]]
            ).kilometers
        return total_distance

    # 2-opt Swap function
    def two_opt_swap(route, i, k):
        new_route = route[:i]
        new_route.extend(reversed(route[i : k + 1]))
        new_route.extend(route[k + 1 :])
        return new_route

    # Function to execute the 2-opt algorithm
    def two_opt(route):
        improvement = True
        while improvement:
            improvement = False
            # あ、ここで全パターンの交換をしてるのか？
            # 全パターンの交換を試して改善がなかったらループを抜けてるのかな。
            for i in range(1, len(route) - 2):
                for k in range(i + 1, len(route) - 1):
                    # 交換の順番がよくわかってないんだよなあ。
                    new_route = two_opt_swap(route, i, k)
                    if calculate_route_distance(new_route) < calculate_route_distance(
                        route
                    ):
                        route = new_route
                        improvement = True
        return route

    # Initial route without the start/end point A
    initial_route = list(points.keys())[1:]
    # Add A as the start and end point
    initial_route = ["CURRENT"] + initial_route + ["CURRENT"]

    optimized_route = two_opt(initial_route)

    print(optimized_route)

    routes_seikika = [current_location]
    # routes_seikikaの頭とけつをのぞいたものをループさせる
    for i in range(1, len(optimized_route) - 1):
        print(i)
        before_name = optimized_route[i - 1]
        now_name = optimized_route[i]
        after_name = optimized_route[i + 1]
        before_point = points[before_name]
        now_st_point = edges[now_name][0]
        now_ed_point = edges[now_name][1]
        after_point = points[after_name]
        # print(points[before_name])
        # print(edges[now_name][0])
        # print(edges[now_name][1])
        # print(points[after_name])

        # before_point→now_st_point→now_ed_point→after_pointまでの距離を計算する
        distance_one = (
            geodesic(before_point, now_st_point).kilometers
            + geodesic(now_st_point, now_ed_point).kilometers
            + geodesic(now_ed_point, after_point).kilometers
        )

        distance_two = (
            geodesic(before_point, now_ed_point).kilometers
            + geodesic(now_ed_point, now_st_point).kilometers
            + geodesic(now_st_point, after_point).kilometers
        )

        print(distance_one)
        print(distance_two)
        if distance_one < distance_two:
            routes_seikika.append(now_st_point)
            routes_seikika.append(now_ed_point)
        if distance_one > distance_two:
            routes_seikika.append(now_ed_point)
            routes_seikika.append(now_st_point)
    routes_seikika.append(current_location)

    print(routes_seikika)

    # # LINESTRINGを緯度と経度のリストに変換する.coords[0]とcoords[1]を入り変えたリストを返す
    gdf_edges["geometry_list"] = gdf_edges["geometry"].apply(
        lambda x: list(map(lambda y: [y[1], y[0]], x.coords))
    )

    # jsonに変換して出力する
    output_dir = f"{os.path.dirname(os.path.abspath(__file__))}/../html/target.json"
    gdf_edges[
        [
            "geometry_list",
            "score_normalization",
            "length",
            "elevation_change_amount",
            "elevation_change_rate",
            "angle_change_amount",
            "angle_change_rate",
            "score",
            "google_map_url",
            "google_earth_url",
            "street_view_url",
        ]
    ].to_json(output_dir, orient="records")

    excution_timer_ins.finish()

    return gdf_edges
