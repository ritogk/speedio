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
from .core.prefecture_polygon import find_prefecture_polygon
from shapely.geometry import Polygon
from .analysis.turn_edge_spliter import split

def main() -> GeoDataFrame:
    env = getEnv()
    consider_gsi_width = env["CONSIDER_GSI_WIDTH"]
    use_custom_area = env["USE_CUSTOM_AREA"]

    excution_timer_ins = ExcutionTimer()

    # 対象範囲のポリゴンを取得する
    excution_timer_ins.start("🗾 get target area polygon", ExcutionType.PROC)
    if use_custom_area:
        top_left = (env["CUSTOM_AREA_POINT_ST"][1], env["CUSTOM_AREA_POINT_ST"][0])
        bottom_right = (env["CUSTOM_AREA_POINT_ED"][1], env["CUSTOM_AREA_POINT_ED"][0])
        top_right = (bottom_right[0], top_left[1])  # 右上
        bottom_left = (top_left[0], bottom_right[1])  # 左下
        search_area_polygon = Polygon([top_left, top_right, bottom_right, bottom_left])
    else:
        prefectures_geojson_path = f"{os.path.dirname(os.path.abspath(__file__))}/../prefectures.geojson"
        search_area_polygon = find_prefecture_polygon(prefectures_geojson_path, "静岡県")
    excution_timer_ins.stop()

    # ベースとなるグラフを取得する
    excution_timer_ins.start("🗾 load openstreetmap data", ExcutionType.FETCH)
    graph = graph_feather.fetch_graph(search_area_polygon)
    excution_timer_ins.stop()

    # グラフをGeoDataFrameに変換する
    excution_timer_ins.start("💱 convert graph to GeoDataFrame")
    gdf_edges = ox.graph_to_gdfs(graph, nodes=False, edges=True)
    # gdf_edgesに列がない場合は追加する
    if "lanes" not in gdf_edges.columns:
        gdf_edges["lanes"] = 1
    if "tunnel" not in gdf_edges.columns:
        gdf_edges["tunnel"] = None
    if "bridge" not in gdf_edges.columns:
        gdf_edges["bridge"] = None
    print(f"  📑 row: {len(gdf_edges)}")
    excution_timer_ins.stop()

    # 不要なエッジを削除
    excution_timer_ins.start("🛣️ remove reverse edge")
    count = len(gdf_edges)
    gdf_edges = remover.reverse_edge.remove(gdf_edges)
    print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_edges)}")
    excution_timer_ins.stop()

    # 開始位置列を追加する
    excution_timer_ins.start("📍 calc start_point")
    gdf_edges["start_point"] = column_generater.start_point.generate(gdf_edges)
    excution_timer_ins.stop()

    excution_timer_ins.start("📍 calc end_point")
    gdf_edges["end_point"] = column_generater.end_point.generate(gdf_edges)
    excution_timer_ins.stop()

    # 全graphを取得する
    excution_timer_ins.start("🗾 load openstreetmap all data", ExcutionType.FETCH)
    g_all = graph_all_feather.fetch_graph(search_area_polygon)
    excution_timer_ins.stop()

    # エッジ内のnodeから分岐数を取得する
    excution_timer_ins.start("🌿 calc connection_node_cnt")
    gdf_edges["connection_node_cnt"] = column_generater.connection_node_cnt.generate(
        gdf_edges, g_all
    )
    excution_timer_ins.stop()

    # 座標間の角度の変化量を求める
    excution_timer_ins.start("📐 calc angle_deltas")
    gdf_edges["angle_deltas"] = column_generater.angle_deltas.generate(gdf_edges)
    excution_timer_ins.stop()

    # 基準に満たないエッジを削除する
    excution_timer_ins.start("🛣️ remove below standard edge")
    count = len(gdf_edges)
    gdf_edges = remover.filter_edge.remove(gdf_edges)
    print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_edges)}")
    excution_timer_ins.stop()

    
    # gdf_edgesがemptyの場合は終了する
    if gdf_edges.empty:
        return gdf_edges

    # 曲がり角の候補を取得する
    excution_timer_ins.start("🔁 calc turn_candidate_points")
    gdf_edges["turn_candidate_points"] = (
        column_generater.turn_candidate_points.generate(gdf_edges)
    )
    excution_timer_ins.stop()

    # 曲がり角を取得する
    excution_timer_ins.start("🔁 calc turn")
    gdf_edges["turn_points"] = column_generater.turn.generate(gdf_edges, g_all)
    excution_timer_ins.stop()

    # 曲がり角を含むエッジを分割する
    excution_timer_ins.start("🔁 split edge in turn")
    gdf_edges = split(gdf_edges)
    excution_timer_ins.stop()

    # 座標間の角度の変化量を求める(分割したのでもう一回実行)
    excution_timer_ins.start("📐 calc angle_deltas")
    gdf_edges["angle_deltas"] = column_generater.angle_deltas.generate(gdf_edges)
    excution_timer_ins.stop()

    # 基準に満たないエッジを削除する(分割したのでもう一回実行)
    excution_timer_ins.start("🗑️ remove below standard edge")
    count = len(gdf_edges)
    gdf_edges = remover.filter_edge.remove(gdf_edges)
    print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_edges)}")
    excution_timer_ins.stop()

    # 座標間の角度の変化量を求める
    excution_timer_ins.start("📐 calc angle_and_length_ratio")
    gdf_edges["angle_and_length_ratio"] = (
        gdf_edges["angle_deltas"] / gdf_edges["length"]
    )
    excution_timer_ins.stop()

    # 座標間の標高の変化量を求める
    tif_path = f"{os.path.dirname(os.path.abspath(__file__))}/../elevation.tif"
    excution_timer_ins.start("🏔️ calc elevation")
    gdf_edges["elevation"] = column_generater.elevation.generate(gdf_edges, tif_path)
    excution_timer_ins.stop()

    # トンネルのデータを取得する
    excution_timer_ins.start("🗾 load osm tunnel data", ExcutionType.FETCH)
    graph_tunnel = graph_tunnel_feather.fetch_graph(search_area_polygon)
    if graph_tunnel is not None:
        gdf_tunnel_edges = ox.graph_to_gdfs(graph_tunnel, nodes=False, edges=True)
    excution_timer_ins.stop()

    if graph_tunnel is not None:
        excution_timer_ins.start("🛣️ remove reverse edge")
        count = len(gdf_tunnel_edges)
        gdf_tunnel_edges = remover.reverse_edge.remove(gdf_tunnel_edges)
        print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_tunnel_edges)}")
        excution_timer_ins.stop()

        # トンネル内の標高を調整する
        excution_timer_ins.start("🏔️ calc elevation_tunnel_regulator")
        gdf_edges["elevation"] = column_generater.elevation_infra_regulator.generate(
            gdf_edges, gdf_tunnel_edges, column_generater.elevation_infra_regulator.InfraType.TUNNEL
        )
        excution_timer_ins.stop()
    
    # 橋のデータを取得する
    excution_timer_ins.start("🌉 load osm bridge data", ExcutionType.FETCH) 
    graph_bridge = graph_bridge_feather.fetch_graph(search_area_polygon)
    if graph_bridge is not None:
        gdf_bridge_edges = ox.graph_to_gdfs(graph_bridge, nodes=False, edges=True)
    excution_timer_ins.stop()

    if graph_bridge is not None:
        excution_timer_ins.start("🗑️ remove reverse edge")
        count = len(gdf_bridge_edges)
        gdf_bridge_edges = remover.reverse_edge.remove(gdf_bridge_edges)
        print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_bridge_edges)}")
        excution_timer_ins.stop()

        # 橋の標高を調整する
        excution_timer_ins.start("🌉 calc elevation_bridge_regulator")
        gdf_edges["elevation"] = column_generater.elevation_infra_regulator.generate(
            gdf_edges, gdf_bridge_edges, column_generater.elevation_infra_regulator.InfraType.BRIDGE
        )
        excution_timer_ins.stop()
    

    # fig, ax = plt.subplots(figsize=(10, 10))
    # ax.set_facecolor('black')  # 背景色を黒に設定
    # ox.plot_graph(graph_tunnel, ax=ax, bgcolor='black', edge_color='red', node_size=5, show=False, close=False, edge_linewidth=5) 
    # ox.plot_graph(graph, ax=ax, bgcolor='black', edge_color='blue', node_size=0, show=False, close=False)
    # plt.show()

    # 国の基準に合わせて傾斜を調整する
    excution_timer_ins.start("🏔️ calc elevation_adjuster")
    gdf_edges["elevation"] = column_generater.elevation_adjuster.generate(
        gdf_edges
    )
    excution_timer_ins.stop()

    # 標高の平準化を行う
    excution_timer_ins.start("🏔️ calc elevation_smooth")
    gdf_edges["elevation_smooth"] = column_generater.elevation_smooth.generate(
        gdf_edges
    )
    excution_timer_ins.stop()

    # 標高の高さ(最小値と最大値の差)を求める
    excution_timer_ins.start("🏔️ calc elevation_height")
    gdf_edges["elevation_height"] = column_generater.elevation_height.generate(
        gdf_edges
    )
    excution_timer_ins.stop()

    # 標高のアップダウン量を求める
    excution_timer_ins.start("🏔️ calc elevation_fluctuation")
    fluctuation_up, fluctuation_down = column_generater.elevation_fluctuation.generate(
        gdf_edges
    )
    gdf_edges["elevation_fluctuation"] = list(
        zip(fluctuation_up.round(2), fluctuation_down.round(2))
    )
    excution_timer_ins.stop()

    # 100m単位の標高の区間リストを生成する
    excution_timer_ins.start("🏔️ calc elevation_segment_list")
    gdf_edges["elevation_segment_list"] = column_generater.elevation_segment_list.generate(
        gdf_edges
    )
    excution_timer_ins.stop()

    # 標高のバンプ数求める。
    excution_timer_ins.start("🏔️ calc elevation_unevenness_count")
    elevation_unevenness_count = column_generater.elevation_unevenness_count.generate(
        gdf_edges
    )
    gdf_edges["elevation_unevenness_count"] = elevation_unevenness_count
    excution_timer_ins.stop()

    # 標高の変化量を求める
    excution_timer_ins.start("🏔️ calc elevation_deltas")
    gdf_edges["elevation_deltas"] = column_generater.elevation_deltas.generate(
        gdf_edges
    )
    excution_timer_ins.stop()

    excution_timer_ins.start("🏔️ calc elevation_height_and_length_ratio")
    gdf_edges["elevation_height_and_length_ratio"] = (
        gdf_edges["elevation_height"] / gdf_edges["length"]
    )
    excution_timer_ins.stop()

    excution_timer_ins.start("🛣️ calc width")
    if consider_gsi_width:
        # gsiの道幅を取得する
        avg_width, min_width = column_generater.width_gsi.generate(gdf_edges)
        gdf_edges["gsi_min_width"] = min_width
        gdf_edges["gsi_avg_width"] = avg_width
        excution_timer_ins.stop()

        # gsiの道幅が6m未満のエッジを削除する. 酷道は4~5m程度の道幅があり、地元の峠道は道幅が6.3mの道幅があるため。
        excution_timer_ins.start("🛣️ remove gsi_avg_width edge")
        count = len(gdf_edges)
        gdf_edges = gdf_edges[gdf_edges["gsi_avg_width"] >= 6]
        print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_edges)}")
        excution_timer_ins.stop()
    else:
        gdf_edges["gsi_min_width"] = 0
        gdf_edges["gsi_avg_width"] = 0
    # alpsmapの道幅を取得する
    excution_timer_ins.start("🛣️ calc alpsmap width")
    gdf_edges["is_alpsmap"] = column_generater.is_alpsmap.generate(gdf_edges)
    avg_width, min_width = column_generater.width_alpsmap.generate(gdf_edges)
    gdf_edges["alpsmap_min_width"] = min_width
    gdf_edges["alpsmap_avg_width"] = avg_width
    excution_timer_ins.stop()

    excution_timer_ins.start("🛣️ fetch locations")
    gdf_edges['locations'] = column_generater.locations.generate(gdf_edges)
    excution_timer_ins.stop()

    # alpsmapの道幅が3m以下のエッジを削除する
    count = len(gdf_edges)
    excution_timer_ins.start("🛣️ remove alpsmap_min_width edge")
    gdf_edges = gdf_edges[
        ~((gdf_edges["is_alpsmap"] == 1) & (gdf_edges["alpsmap_min_width"] <= 3))
    ]
    print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_edges)}")
    excution_timer_ins.stop()

    # 標高と距離の比率を求める
    excution_timer_ins.start("🏔️ calc elevation_deltas_and_length_ratio")
    gdf_edges["elevation_deltas_and_length_ratio"] = (
        gdf_edges["elevation_deltas"] / gdf_edges["length"]
    )
    excution_timer_ins.stop()

    # # 標高と距離の比率が0.02未満のエッジを削除する
    # count = len(gdf_edges)
    # gdf_edges = remover.elevation_min_height.remove(gdf_edges)
    # # 元のデータの長さと削除後のデータの長さを表示する
    # print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_edges)}")

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

    # ステアリングホイールの角度を計算する
    excution_timer_ins.start("🛞 calc steering_wheel_angle")
    gdf_edges["steering_wheel_angle_info"] = column_generater.steering_wheel_angle.generate(
        gdf_edges
    )
    excution_timer_ins.stop()

    # ステアリングホイールの最大角度を計算する
    excution_timer_ins.start("🛞 calc steering_wheel_max_angle")
    gdf_edges["steering_wheel_max_angle"] = gdf_edges["steering_wheel_angle_info"].apply(
        lambda angle_info_list: max(item['steering_angle'] for item in angle_info_list) if angle_info_list else None
    )
    excution_timer_ins.stop()

    # ステアリングホイールの平均角度を計算する
    excution_timer_ins.start("🛞 calc steering_wheel_avg_angle")
    gdf_edges["steering_wheel_avg_angle"] = gdf_edges["steering_wheel_angle_info"].apply(
        lambda angle_info_list: sum(item['steering_angle'] for item in angle_info_list) / len(angle_info_list) if angle_info_list else None
    )
    excution_timer_ins.stop()
    
    # 道の区間情報を取得する
    excution_timer_ins.start("🛞 calc road_section")
    gdf_edges["road_section"] = column_generater.road_section.generate(
        gdf_edges
    )
    gdf_edges["road_section_cnt"] = gdf_edges["road_section"].apply(lambda x: len(x))
    excution_timer_ins.stop()

    # 道の区間数が少ないエッジを削除する
    excution_timer_ins.start("🛞 remove road_section_small_count")
    count = len(gdf_edges)
    gdf_edges = remover.remove_road_section_small_count.remove(gdf_edges)
    print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_edges)}")
    excution_timer_ins.stop()

    # コーナーがないエッジを削除する
    excution_timer_ins.start("🛞 remove no corner edge")
    count = len(gdf_edges)
    gdf_edges = gdf_edges[gdf_edges['road_section'].apply(lambda x: any(d.get('section_type') != 'straight' for d in x))]
    print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_edges)}")
    excution_timer_ins.stop()

    # コーナーをグループ化する
    excution_timer_ins.start("🛞 calc corners_group")
    gdf_edges["corners_group"] = column_generater.corners_group.generate(
        gdf_edges
    )
    excution_timer_ins.stop()

    excution_timer_ins.start("🏚️ calc building_nearby_cnt")
    gdf_edges["building_nearby_cnt"] = column_generater.building_nearby_cnt.generate(gdf_edges)
    excution_timer_ins.stop()

    # スコアを求める
    excution_timer_ins.start("🏆 calc score")
    gdf_edges["score_elevation_over_heiht"] = (
        column_generater.score_elevation_over_heiht.generate(gdf_edges)
    )
    gdf_edges["score_elevation_unevenness"] = (
        column_generater.score_elevation_unevenness.generate(gdf_edges)
    )
    gdf_edges["score_elevation"] = column_generater.score_elevation.generate(gdf_edges)
    gdf_edges["score_elevation_deviation"] = column_generater.score_elevation_deviation.generate(gdf_edges) 
    gdf_edges["score_angle"] = 1
    gdf_edges["score_length"] = column_generater.score_length.generate(gdf_edges)
    gdf_edges["score_width"] = column_generater.score_width.generate(gdf_edges)
    # gdf_edges["score_width"] = 1
    score_corner_week, score_corner_medium, score_corner_strong, score_corner_none = column_generater.score_corner_level.generate(gdf_edges)
    gdf_edges["score_corner_week"] = score_corner_week
    gdf_edges["score_corner_medium"] = score_corner_medium
    gdf_edges["score_corner_strong"] = score_corner_strong
    gdf_edges["score_corner_none"] = score_corner_none
    gdf_edges["score_corner_balance"] = column_generater.score_corner_balance.generate(gdf_edges)
    gdf_edges["score_building"] = column_generater.score_building.generate(gdf_edges)
    excution_timer_ins.stop()

    # google map urlを生成する
    excution_timer_ins.start("🔗 create google_map_url")
    gdf_edges["google_map_url"] = column_generater.google_map_url.generate(gdf_edges)
    excution_timer_ins.stop()

    # street_view_url_list
    excution_timer_ins.start("test")
    gdf_edges["street_view_url_list"] = column_generater.street_view_url_list.generate(
        gdf_edges
    )
    gdf_edges["score"] = column_generater.score.generate(gdf_edges, 'normal')
    gdf_edges["standard_score"] = column_generater.score.generate(gdf_edges, 'standard')
    gdf_edges["week_corner_score"] = column_generater.score.generate(gdf_edges, 'week_corner')
    gdf_edges["medium_corner_score"] = column_generater.score.generate(gdf_edges, 'medium_corner')
    gdf_edges["strong_corner_score"] = column_generater.score.generate(gdf_edges, 'strong_corner')
    excution_timer_ins.stop()
    gdf_edges["geometry_check_list"] = gdf_edges["street_view_url_list"]

    # google earth urlを生成する
    excution_timer_ins.start("🔗 create google_earth_url")
    gdf_edges["google_earth_url"] = column_generater.google_earth_url.generate(
        gdf_edges
    )
    excution_timer_ins.stop()

    # street view urlを生成する
    excution_timer_ins.start("🔗 create street_view_url")
    gdf_edges["street_view_url"] = column_generater.street_view_url.generate(gdf_edges)
    excution_timer_ins.stop()

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
        "locations"
    ]

    # gdf_edges.scoreの上位100件を取得する
    gdf_edges_week = gdf_edges.sort_values("standard_score", ascending=False).head(200)
    output_dir = f"{os.path.dirname(os.path.abspath(__file__))}/../html/standard.csv"
    gdf_edges_week[output_columns].to_csv(output_dir, index=False)

    # gdf_edges.scoreの上位100件を取得する
    gdf_edges_week = gdf_edges.sort_values("week_corner_score", ascending=False).head(200)
    # gdf_edges_week = gdf_edges.sort_values("week_corner_score", ascending=False).iloc[100:200]
    output_dir = f"{os.path.dirname(os.path.abspath(__file__))}/../html/week_corner.csv"
    gdf_edges_week[output_columns].to_csv(output_dir, index=False)

    gdf_edges_medium = gdf_edges.sort_values("medium_corner_score", ascending=False).head(200)
    # gdf_edges_medium = gdf_edges.sort_values("medium_corner_score", ascending=False).iloc[100:200]
    output_dir = f"{os.path.dirname(os.path.abspath(__file__))}/../html/medium_corner.csv"
    gdf_edges_medium[output_columns].to_csv(output_dir, index=False)

    gdf_edges_strong = gdf_edges.sort_values("strong_corner_score", ascending=False).head(200)
    # gdf_edges_strong = gdf_edges.sort_values("strong_corner_score", ascending=False).iloc[100:200]
    output_dir = f"{os.path.dirname(os.path.abspath(__file__))}/../html/strong_corner.csv"
    gdf_edges_strong[output_columns].to_csv(output_dir, index=False)
    excution_timer_ins.finish()

    # gdf_edgesをscoreの大きい順に並び替える
    gdf_edges = gdf_edges.sort_values("score", ascending=False)

    # jsonに変換して出力する
    output_columns = [
        "length",
        "highway",
        "name",
        "geometry_list",
        "geometry_meter_list",
        "geometry_check_list",
        "elevation_height",
        "elevation_deltas",
        "elevation_deltas_and_length_ratio",
        "elevation_height_and_length_ratio",
        "elevation_smooth",
        "elevation",
        "elevation_segment_list",
        "elevation_unevenness_count",
        "angle_deltas",
        "angle_and_length_ratio",
        "score_elevation",
        "score_elevation_over_heiht",
        "score_elevation_unevenness",
        "score_elevation_deviation",
        "score_angle",
        "score_width",
        "score_length",
        "score_corner_week",
        "score_corner_medium",
        "score_corner_strong",
        "score_corner_none",
        "score_corner_balance",
        "score_building",
        "google_map_url",
        "google_earth_url",
        "street_view_url_list",
        "street_view_url",
        "lanes",
        "gsi_min_width",
        "gsi_avg_width",
        # "is_alpsmap",
        "alpsmap_min_width",
        "alpsmap_avg_width",
        "turn_candidate_points",
        "turn_points",
        "road_section",
        "corners_group",
        "tunnel",
        "bridge",
        "steering_wheel_angle_info",
        "steering_wheel_max_angle",
        "steering_wheel_avg_angle",
        "locations",
        "building_nearby_cnt",
        "road_section_cnt",
    ]
    output_dir = f"{os.path.dirname(os.path.abspath(__file__))}/../html/target.json"
    gdf_edges[output_columns].to_json(output_dir, orient="records")
    output_dir_bk = f"{os.path.dirname(os.path.abspath(__file__))}/../html/json_bk/{datetime.now().strftime('%Y-%m-%d-%H-%M')}.json"
    gdf_edges[output_columns].to_json(output_dir_bk, orient="records")

    return gdf_edges
