from .core import excution_timer
from .analysis import graph_feather
from .analysis import column_generater
from .analysis import remover
import osmnx as ox
from geopandas import GeoDataFrame
import os


def main() -> GeoDataFrame:
    consider_width = False

    point_st = (34.96993444329437, 137.3649884327475)
    point_ed = (34.89343982454937, 137.48223336530324)

    # latitude_start = 34.898635
    # longitude_start = 133.030126
    # latitude_end = 34.635895
    # longitude_end = 133.575308

    excution_timer_ins = excution_timer.ExcutionTimer()

    excution_timer_ins.start("load openstreetmap data")
    graph = graph_feather.fetch_graph(
        point_st[0], point_st[1], point_ed[0], point_ed[1]
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
        gdf_edges, point_st[0], point_st[1], point_ed[0], point_ed[1]
    )
    excution_timer_ins.stop()

    # 座標間の角度の変化量を求める
    excution_timer_ins.start("calc angle_deltas")
    gdf_edges["angle_deltas"] = column_generater.angle_deltas.generate(gdf_edges)
    excution_timer_ins.stop()

    # 基準に満たないエッジを削除する
    excution_timer_ins.start("remove below standard edge")
    gdf_edges = remover.filter_edge.remove(gdf_edges)
    excution_timer_ins.stop()

    # 座標間の角度の変化量を求める
    excution_timer_ins.start("calc angle_deltas")
    gdf_edges["angle_and_length_radio"] = (
        gdf_edges["angle_deltas"] / gdf_edges["length"]
    )
    excution_timer_ins.stop()

    # 座標間の標高の変化量を求める

    # ./tyugoku.tifのフルパスを取得する
    tif_path = f"{os.path.dirname(os.path.abspath(__file__))}/../elavation.tif"
    print(tif_path)
    excution_timer_ins.start("calc elevation_deltas")
    elevation_deltas_serice, elevation_serice = (
        column_generater.elevation_deltas.generate(gdf_edges, tif_path)
    )
    gdf_edges["elevation_deltas"] = elevation_deltas_serice
    gdf_edges["elevations"] = elevation_serice
    excution_timer_ins.stop()

    excution_timer_ins.start("calc width")
    if consider_width:
        # gsiの道幅を取得する
        avg_width, min_width = column_generater.width_gsi.generate(gdf_edges)
        gdf_edges["gsi_min_width"] = min_width
        gdf_edges["gsi_avg_width"] = avg_width
        excution_timer_ins.stop()

        # gsiの道幅が6m未満のエッジを削除する. 酷道は4~5m程度の道幅があり、地元の峠道は道幅が6.3mの道幅があるため。
        excution_timer_ins.start("remove gsi_min_width edge")
        gdf_edges = gdf_edges[gdf_edges["gsi_min_width"] >= 6]
        excution_timer_ins.stop()

        # alpsmapの道幅を取得する
        excution_timer_ins.start("calc alpsmap width")
        gdf_edges["is_alpsmap"] = column_generater.is_alpsmap.generate(gdf_edges)
        avg_width, min_width = column_generater.width_alpsmap.generate(gdf_edges)
        gdf_edges["alpsmap_min_width"] = min_width
        gdf_edges["alpsmap_avg_width"] = avg_width
        excution_timer_ins.stop()

        # alpsmapの道幅が3m以下のエッジを削除する
        excution_timer_ins.start("remove alpsmap_min_width edge")
        gdf_edges = gdf_edges[
            ~((gdf_edges["is_alpsmap"] == 1) & (gdf_edges["alpsmap_min_width"] <= 3))
        ]
    else:
        gdf_edges["gsi_min_width"] = 0
        gdf_edges["gsi_avg_width"] = 0
        gdf_edges["is_alpsmap"] = 1
        gdf_edges["alpsmap_min_width"] = 0
        gdf_edges["alpsmap_avg_width"] = 0
        gdf_edges["lanes"] = 2

    excution_timer_ins.stop()

    # 標高と距離の比率を求める
    excution_timer_ins.start("calc elevation_and_length_radio")
    gdf_edges["elevation_and_length_radio"] = (
        gdf_edges["elevation_deltas"] / gdf_edges["length"]
    )
    excution_timer_ins.stop()

    # スコアを求める
    excution_timer_ins.start("calc score")
    gdf_edges["score_elevation"] = column_generater.score_elevation.generate(gdf_edges)
    gdf_edges["score_angle"] = column_generater.score_angle.generate(gdf_edges)
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

    # # ナビゲーション用URLを生成する
    # excution_timer_ins.start("create navigation_url")
    # shortest_navi_generater.generate(
    #     latitude_start,
    #     longitude_start,
    #     latitude_end,
    #     longitude_end,
    #     graph,
    #     gdf_edges,
    #     10,
    # )
    # excution_timer_ins.stop()

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
            "elevation_deltas",
            "elevation_and_length_radio",
            "angle_deltas",
            "angle_and_length_radio",
            "score",
            "score_elevation",
            "score_angle",
            "google_map_url",
            "google_earth_url",
            "street_view_url",
            "lanes",
            "gsi_min_width",
            "gsi_avg_width",
            "is_alpsmap",
            "alpsmap_min_width",
            "alpsmap_avg_width",
        ]
    ].to_json(output_dir, orient="records")

    excution_timer_ins.finish()

    # # gdf_edgesのavg_widthを小さい順に並び替える
    # gdf_edges = gdf_edges.sort_values("avg_width")

    return gdf_edges
