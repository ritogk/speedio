from .core.excution_timer import ExcutionTimer, ExcutionType
from .analysis import graph_feather
from .analysis import graph_all_feather
from .analysis import graph_tunnel_feather
from .analysis import graph_bridge_feather
from .analysis import column_generater
from .analysis import remover
import osmnx as ox
from geopandas import GeoDataFrame
import os
from .core.env import getEnv
from datetime import datetime

import matplotlib.pyplot as plt

from .analysis.turn_edge_spliter import split

def main() -> GeoDataFrame:
    env = getEnv()
    consider_gsi_width = env["CONSIDER_GSI_WIDTH"]
    point_st = env["POINT_ST"]
    point_ed = env["POINT_ED"]

    excution_timer_ins = ExcutionTimer()

    excution_timer_ins.start("load openstreetmap data", ExcutionType.FETCH)
    graph = graph_feather.fetch_graph(
        point_st[0], point_st[1], point_ed[0], point_ed[1]
    )
    excution_timer_ins.stop()

    excution_timer_ins.start("convert graph to GeoDataFrame")
    gdf_edges = ox.graph_to_gdfs(graph, nodes=False, edges=True)
    print(f"  row: {len(gdf_edges)}")
    excution_timer_ins.stop()

    # gdf_edgesにlanes列がない場合は追加する
    if "lanes" not in gdf_edges.columns:
        gdf_edges["lanes"] = 1
    # gdf_edgesにtunnel列がない場合は追加する
    if "tunnel" not in gdf_edges.columns:
        gdf_edges["tunnel"] = None

    excution_timer_ins.start("remove reverse edge")
    count = len(gdf_edges)
    gdf_edges = remover.reverse_edge.remove(gdf_edges)
    print(f"  row: {count}, deleted: {count - len(gdf_edges)}")
    excution_timer_ins.stop()

    # 開始位置列を追加する
    excution_timer_ins.start("calc start_point")
    gdf_edges["start_point"] = column_generater.start_point.generate(gdf_edges)
    excution_timer_ins.stop()

    excution_timer_ins.start("calc end_point")
    gdf_edges["end_point"] = column_generater.end_point.generate(gdf_edges)
    excution_timer_ins.stop()

    # 全graphを取得する
    excution_timer_ins.start("load openstreetmap all data", ExcutionType.FETCH)
    g_all = graph_all_feather.fetch_graph(
        point_st[0], point_st[1], point_ed[0], point_ed[1]
    )
    excution_timer_ins.stop()

    # エッジ内のnodeから分岐数を取得する
    excution_timer_ins.start("calc connection_node_cnt")
    gdf_edges["connection_node_cnt"] = column_generater.connection_node_cnt.generate(
        gdf_edges, g_all
    )
    excution_timer_ins.stop()

    # 座標間の角度の変化量を求める
    excution_timer_ins.start("calc angle_deltas")
    gdf_edges["angle_deltas"] = column_generater.angle_deltas.generate(gdf_edges)
    excution_timer_ins.stop()

    # 基準に満たないエッジを削除する
    excution_timer_ins.start("remove below standard edge")
    count = len(gdf_edges)
    gdf_edges = remover.filter_edge.remove(gdf_edges)
    print(f"  row: {count}, deleted: {count - len(gdf_edges)}")
    excution_timer_ins.stop()

    # gdf_edgesがemptyの場合は終了する
    if gdf_edges.empty:
        return gdf_edges

    # 曲がり角の候補を取得する
    excution_timer_ins.start("calc turn_candidate_points")
    gdf_edges["turn_candidate_points"] = (
        column_generater.turn_candidate_points.generate(gdf_edges)
    )
    excution_timer_ins.stop()

    # 曲がり角を取得する
    excution_timer_ins.start("calc turn")
    gdf_edges["turn_points"] = column_generater.turn.generate(gdf_edges, g_all)
    excution_timer_ins.stop()

    # 曲がり角を含むエッジを分割する
    excution_timer_ins.start("split edge in turn")
    gdf_edges = split(gdf_edges)
    excution_timer_ins.stop()

    # 座標間の角度の変化量を求める(分割したのでもう一回実行)
    excution_timer_ins.start("calc angle_deltas")
    gdf_edges["angle_deltas"] = column_generater.angle_deltas.generate(gdf_edges)
    excution_timer_ins.stop()

    # 基準に満たないエッジを削除する(分割したのでもう一回実行)
    excution_timer_ins.start("remove below standard edge")
    count = len(gdf_edges)
    gdf_edges = remover.filter_edge.remove(gdf_edges)
    print(f"  row: {count}, deleted: {count - len(gdf_edges)}")
    excution_timer_ins.stop()

    # 座標間の角度の変化量を求める
    excution_timer_ins.start("calc angle_deltas")
    gdf_edges["angle_and_length_ratio"] = (
        gdf_edges["angle_deltas"] / gdf_edges["length"]
    )
    excution_timer_ins.stop()

    # 座標間の標高の変化量を求める
    tif_path = f"{os.path.dirname(os.path.abspath(__file__))}/../elavation.tif"
    excution_timer_ins.start("calc elevation")
    gdf_edges["elevation"] = column_generater.elevation.generate(gdf_edges, tif_path)
    excution_timer_ins.stop()

    # トンネルのデータを取得する
    excution_timer_ins.start("load osm tunnel data", ExcutionType.FETCH)
    graph_tunnel = graph_tunnel_feather.fetch_graph(
        point_st[0], point_st[1], point_ed[0], point_ed[1]
    )
    if graph_tunnel is not None:
        gdf_tunnel_edges = ox.graph_to_gdfs(graph_tunnel, nodes=False, edges=True)
    excution_timer_ins.stop()

    if graph_tunnel is not None:
        excution_timer_ins.start("remove reverse edge")
        count = len(gdf_tunnel_edges)
        gdf_tunnel_edges = remover.reverse_edge.remove(gdf_tunnel_edges)
        print(f"  row: {count}, deleted: {count - len(gdf_tunnel_edges)}")
        excution_timer_ins.stop()

        # トンネル内の標高を調整する
        excution_timer_ins.start("calc elevation_tunnel_regulator")
        gdf_edges["elevation"] = column_generater.elevation_tunnel_regulator.generate(
            gdf_edges, gdf_tunnel_edges, tif_path
        )
        excution_timer_ins.stop()
    
    # 橋のデータを取得する
    excution_timer_ins.start("load osm bridge data", ExcutionType.FETCH) 
    graph_bridge = graph_bridge_feather.fetch_graph(
        point_st[0], point_st[1], point_ed[0], point_ed[1]
    )
    if graph_bridge is not None:
        gdf_bridge_edges = ox.graph_to_gdfs(graph_bridge, nodes=False, edges=True)
    excution_timer_ins.stop()

    if graph_bridge is not None:
        excution_timer_ins.start("remove reverse edge")
        count = len(gdf_bridge_edges)
        gdf_bridge_edges = remover.reverse_edge.remove(gdf_bridge_edges)
        print(f"  row: {count}, deleted: {count - len(gdf_bridge_edges)}")
        excution_timer_ins.stop()

        # 橋の標高を調整する
        excution_timer_ins.start("calc elevation_bridge_regulator")
        gdf_edges["elevation"] = column_generater.elevation_bridge_regulator.generate(
            gdf_edges, gdf_bridge_edges
        )
        excution_timer_ins.stop()
    

    # fig, ax = plt.subplots(figsize=(10, 10))
    # ax.set_facecolor('black')  # 背景色を黒に設定
    # ox.plot_graph(graph_tunnel, ax=ax, bgcolor='black', edge_color='red', node_size=5, show=False, close=False, edge_linewidth=5) 
    # ox.plot_graph(graph, ax=ax, bgcolor='black', edge_color='blue', node_size=0, show=False, close=False)
    # plt.show()

    # 標高の平準化を行う
    excution_timer_ins.start("calc elevation_smooth")
    gdf_edges["elevation_smooth"] = column_generater.elevation_smooth.generate(
        gdf_edges
    )
    excution_timer_ins.stop()

    # 標高の高さ(最小値と最大値の差)を求める
    excution_timer_ins.start("calc elevation_height")
    gdf_edges["elevation_height"] = column_generater.elavation_height.generate(
        gdf_edges
    )
    excution_timer_ins.stop()

    # 標高のアップダウン量を求める
    excution_timer_ins.start("calc elevation_fluctuation")
    fluctuation_up, fluctuation_down = column_generater.elevation_fluctuation.generate(
        gdf_edges
    )
    gdf_edges["elevation_fluctuation"] = list(
        zip(fluctuation_up.round(2), fluctuation_down.round(2))
    )
    excution_timer_ins.stop()

    # 標高のU字型の特徴量を求める
    excution_timer_ins.start("calc elevation_u_shape")
    gdf_edges["elevation_u_shape"] = column_generater.elevation_u_shape.generate(
        gdf_edges
    )
    excution_timer_ins.stop()

    # 標高の変化量を求める
    excution_timer_ins.start("calc elevation_deltas")
    gdf_edges["elevation_deltas"] = column_generater.elevation_deltas.generate(
        gdf_edges
    )
    excution_timer_ins.stop()

    excution_timer_ins.start("calc elavation_height_and_length_ratio")
    gdf_edges["elavation_height_and_length_ratio"] = (
        gdf_edges["elevation_height"] / gdf_edges["length"]
    )
    excution_timer_ins.stop()

    excution_timer_ins.start("calc width")
    if consider_gsi_width:
        # gsiの道幅を取得する
        avg_width, min_width = column_generater.width_gsi.generate(gdf_edges)
        gdf_edges["gsi_min_width"] = min_width
        gdf_edges["gsi_avg_width"] = avg_width
        excution_timer_ins.stop()

        # gsiの道幅が6m未満のエッジを削除する. 酷道は4~5m程度の道幅があり、地元の峠道は道幅が6.3mの道幅があるため。
        excution_timer_ins.start("remove gsi_avg_width edge")
        count = len(gdf_edges)
        gdf_edges = gdf_edges[gdf_edges["gsi_avg_width"] >= 6]
        print(f"  row: {count}, deleted: {count - len(gdf_edges)}")
        excution_timer_ins.stop()
    else:
        gdf_edges["gsi_min_width"] = 0
        gdf_edges["gsi_avg_width"] = 0
    # alpsmapの道幅を取得する
    excution_timer_ins.start("calc alpsmap width")
    gdf_edges["is_alpsmap"] = column_generater.is_alpsmap.generate(gdf_edges)
    avg_width, min_width = column_generater.width_alpsmap.generate(gdf_edges)
    gdf_edges["alpsmap_min_width"] = min_width
    gdf_edges["alpsmap_avg_width"] = avg_width
    excution_timer_ins.stop()

    # alpsmapの道幅が3m以下のエッジを削除する
    count = len(gdf_edges)
    excution_timer_ins.start("remove alpsmap_min_width edge")
    gdf_edges = gdf_edges[
        ~((gdf_edges["is_alpsmap"] == 1) & (gdf_edges["alpsmap_min_width"] <= 3))
    ]
    print(f"  row: {count}, deleted: {count - len(gdf_edges)}")
    excution_timer_ins.stop()

    # 標高と距離の比率を求める
    excution_timer_ins.start("calc elevation_deltas_and_length_ratio")
    gdf_edges["elevation_deltas_and_length_ratio"] = (
        gdf_edges["elevation_deltas"] / gdf_edges["length"]
    )
    excution_timer_ins.stop()

    # # 標高と距離の比率が0.02未満のエッジを削除する
    # count = len(gdf_edges)
    # gdf_edges = remover.elevation_min_height.remove(gdf_edges)
    # # 元のデータの長さと削除後のデータの長さを表示する
    # print(f"  row: {count}, deleted: {count - len(gdf_edges)}")

    # # LINESTRINGを緯度と経度のリストに変換する.coords[0]とcoords[1]を入り変えたリストを返す
    gdf_edges["geometry_list"] = gdf_edges["geometry"].apply(
        lambda x: list(map(lambda y: [y[1], y[0]], x.coords))
    )
    gdf_edges["geometry_meter_list"] = (
        column_generater.geometry_meter_list.generate(gdf_edges)
    )

    # # 目視チェックした道幅をセットする
    # eye_meadured_width_path = (
    #     f"{os.path.dirname(os.path.abspath(__file__))}/../eye_meadured_width.csv"
    # )
    # excution_timer_ins.start("calc eye_measured_width")
    # gdf_edges["eye_measured_width"] = column_generater.eye_measured_width.generate(
    #     gdf_edges, eye_meadured_width_path
    # )
    # excution_timer_ins.stop()

    # コーナーの情報を取得する
    excution_timer_ins.start("calc corners")
    gdf_edges["corners"] = column_generater.corners.generate(
        gdf_edges
    )
    excution_timer_ins.stop()

    # スコアを求める
    excution_timer_ins.start("calc score")
    gdf_edges["score_elevation_over_heiht"] = (
        column_generater.score_elevation_over_heiht.generate(gdf_edges)
    )
    gdf_edges["score_elevation_u_shape"] = (
        column_generater.score_elevation_u_shape.generate(gdf_edges)
    )
    gdf_edges["score_elevation"] = column_generater.score_elevation.generate(gdf_edges)
    # gdf_edges["score_angle"] = column_generater.score_angle.generate(gdf_edges)
    gdf_edges["score_angle"] = 1
    gdf_edges["score_length"] = column_generater.score_length.generate(gdf_edges)
    gdf_edges["score_width"] = column_generater.score_width.generate(gdf_edges)
    # gdf_edges["score_width"] = 1
    score_high_speed_corner, score_medium_speed_corner, score_low_speed_corner = column_generater.score_corner.generate(gdf_edges)
    gdf_edges["score_high_speed_corner"] = score_high_speed_corner
    gdf_edges["score_medium_speed_corner"] = score_medium_speed_corner
    gdf_edges["score_low_speed_corner"] = score_low_speed_corner
    excution_timer_ins.stop()

    # google map urlを生成する
    excution_timer_ins.start("create google_map_url")
    gdf_edges["google_map_url"] = column_generater.google_map_url.generate(gdf_edges)
    excution_timer_ins.stop()

    # street_view_url_list
    excution_timer_ins.start("test")
    gdf_edges["street_view_url_list"] = column_generater.street_view_url_list.generate(
        gdf_edges
    )
    gdf_edges["score"] = column_generater.score.generate(gdf_edges)
    excution_timer_ins.stop()
    gdf_edges["geometry_check_list"] = gdf_edges["street_view_url_list"]

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

    # jsonに変換して出力する
    output_columns = [
        "length",
        "highway",
        "geometry_list",
        "geometry_meter_list",
        "geometry_check_list",
        "elevation_height",
        "elevation_deltas",
        "elevation_deltas_and_length_ratio",
        "elavation_height_and_length_ratio",
        "elevation_u_shape",
        "elevation_smooth",
        "elevation",
        "angle_deltas",
        "angle_and_length_ratio",
        "score_elevation",
        "score_elevation_over_heiht",
        "score_elevation_u_shape",
        "score_angle",
        "score_width",
        "score_length",
        "score_high_speed_corner",
        "score_medium_speed_corner",
        "score_low_speed_corner",
        "google_map_url",
        "google_earth_url",
        "street_view_url_list",
        "street_view_url",
        "lanes",
        "gsi_min_width",
        "gsi_avg_width",
        "is_alpsmap",
        "alpsmap_min_width",
        "alpsmap_avg_width",
        "turn_candidate_points",
        "turn_points",
        "corners",
        "tunnel",
        "bridge"
        # "eye_measured_width",
    ]
    output_dir = f"{os.path.dirname(os.path.abspath(__file__))}/../html/target.json"
    gdf_edges[output_columns].to_json(output_dir, orient="records")
    output_dir_bk = f"{os.path.dirname(os.path.abspath(__file__))}/../html/json_bk/{datetime.now().strftime('%Y-%m-%d-%H-%M')}.json"
    gdf_edges[output_columns].to_json(output_dir_bk, orient="records")

    # csvに変換して出力する
    output_columns = [
        "length",
        "highway",
        "street_view_url_list",
        "geometry_list",
        "geometry_check_list",
        "google_map_url",
        "score",
        "lanes",
        "gsi_min_width",
        "gsi_avg_width",
        "is_alpsmap",
        "alpsmap_min_width",
        "alpsmap_avg_width",
    ]
    # gdf_edges.scoreの上位100件を取得する
    gdf_edges = gdf_edges.sort_values("score", ascending=False).head(100)
    output_dir = f"{os.path.dirname(os.path.abspath(__file__))}/../html/target.csv"
    gdf_edges[output_columns].to_csv(output_dir, index=False)

    excution_timer_ins.finish()

    # # gdf_edgesのavg_widthを小さい順に並び替える
    # gdf_edges = gdf_edges.sort_values("avg_width")

    return gdf_edges
