from .core import excution_timer
from .analysis import graph_feather
from .analysis import column_generater
from .analysis import remover
import osmnx as ox
from geopandas import GeoDataFrame
import os
from .core import shortest_navi_generater


def main() -> GeoDataFrame:
    # 自宅周辺の軽いデータ
    latitude_start = 35.330878
    longitude_start = 136.951774
    latitude_end = 35.402261
    longitude_end = 137.072889

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

    # ナビゲーション用URLを生成する
    excution_timer_ins.start("create navigation_url")
    shortest_navi_generater.generate(
        latitude_start,
        longitude_start,
        latitude_end,
        longitude_end,
        graph,
        gdf_edges,
        10,
    )
    excution_timer_ins.stop()

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
