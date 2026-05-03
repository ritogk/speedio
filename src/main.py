from .core.execution_timer import ExecutionTimer, ExecutionType
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
from shapely.geometry import Polygon, MultiPolygon
from .analysis.turn_edge_spliter import split


from .core.terrain_elevation_generator import write_terrain_elevations_file, generate_file_path

# 指定したポリゴン内を対象に処理を行う。
def main(search_area_polygon:Polygon|MultiPolygon, plane_epsg_code:str, prefecture_code:str) -> GeoDataFrame:
    env = getEnv()
    consider_gsi_width = env["CONSIDER_GSI_WIDTH"]
    create_video = env["CREATE_VIDEO"]
    create_terrain = env["CREATE_TERRAIN"]

    execution_timer_ins = ExecutionTimer()
    # ベースとなるグラフを取得する
    execution_timer_ins.start("🗾 load openstreetmap data", ExecutionType.FETCH)
    graph = graph_feather.fetch_graph(search_area_polygon)
    execution_timer_ins.stop()

    # グラフをGeoDataFrameに変換する
    execution_timer_ins.start("💱 convert graph to GeoDataFrame")
    gdf_edges = ox.graph_to_gdfs(graph, nodes=False, edges=True)
    # gdf_edgesに列がない場合は追加する
    if "lanes" not in gdf_edges.columns:
        gdf_edges["lanes"] = 1
    if "tunnel" not in gdf_edges.columns:
        gdf_edges["tunnel"] = "no"
    if "tunnel_length" not in gdf_edges.columns:
        gdf_edges["tunnel_length"] = 0
    if "bridge" not in gdf_edges.columns:
        gdf_edges["bridge"] = "no"
    if "name" not in gdf_edges.columns:
        gdf_edges["name"] = ""
    
    # tunnelとbridgeの値がnanの場合はnoに変換する
    gdf_edges["tunnel"] = gdf_edges["tunnel"].fillna("no")
    gdf_edges["bridge"] = gdf_edges["bridge"].fillna("no")
    print(f"  📑 row: {len(gdf_edges)}")
    execution_timer_ins.stop()

    # # LINESTRINGを緯度と経度のリストに変換する.coords[0]とcoords[1]を入り変えたリストを返す
    gdf_edges["geometry_list"] = gdf_edges["geometry"].apply(
        lambda x: list(map(lambda y: [y[1], y[0]], x.coords))
    )
    gdf_edges["geometry_meter_list"] = (
        column_generater.geometry_meter_list.generate(gdf_edges, plane_epsg_code)
    )

    # 不要なエッジを削除
    execution_timer_ins.start("🛣️ remove reverse edge")
    count = len(gdf_edges)
    gdf_edges = remover.reverse_edge.remove(gdf_edges)
    print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_edges)}")
    execution_timer_ins.stop()

    # # geometry_listを滑らかにする
    # execution_timer_ins.start("🌊 smooth geometry")
    # gdf_edges["geometry"] = column_generater.geometry_smooth.generate(gdf_edges)
    # print(gdf_edges["geometry"])
    # execution_timer_ins.stop()

    # 開始位置列を追加する
    execution_timer_ins.start("📍 calc start_point")
    gdf_edges["start_point"] = column_generater.start_point.generate(gdf_edges)
    execution_timer_ins.stop()

    execution_timer_ins.start("📍 calc end_point")
    gdf_edges["end_point"] = column_generater.end_point.generate(gdf_edges)
    execution_timer_ins.stop()

    # 全graphを取得する
    execution_timer_ins.start("🗾 load openstreetmap all data", ExecutionType.FETCH)
    g_all = graph_all_feather.fetch_graph(search_area_polygon)
    execution_timer_ins.stop()

    # エッジ内のnodeから分岐数を取得する
    execution_timer_ins.start("🌿 calc connection_node_cnt")
    gdf_edges["connection_node_cnt"] = column_generater.connection_node_cnt.generate(
        gdf_edges, g_all
    )
    execution_timer_ins.stop()

    # 座標間の角度の変化量を求める
    execution_timer_ins.start("📐 calc angle_deltas")
    gdf_edges["angle_deltas"] = column_generater.angle_deltas.generate(gdf_edges)
    execution_timer_ins.stop()

    # 基準に満たないエッジを削除する
    execution_timer_ins.start("🛣️ remove below standard edge")
    count = len(gdf_edges)
    gdf_edges = remover.filter_edge.remove(gdf_edges)
    print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_edges)}")
    execution_timer_ins.stop()
    
    # gdf_edgesがemptyの場合は終了する
    if gdf_edges.empty:
        print("gdf_edges is empty. exit process.")
        return gdf_edges

    # 曲がり角の候補を取得する
    execution_timer_ins.start("🔁 calc turn_candidate_points")
    gdf_edges["turn_candidate_points"] = (
        column_generater.turn_candidate_points.generate(gdf_edges)
    )
    execution_timer_ins.stop()

    # 曲がり角を取得する
    execution_timer_ins.start("🔁 calc turn")
    gdf_edges["turn_points"] = column_generater.turn.generate(gdf_edges, g_all)
    execution_timer_ins.stop()

    # 曲がり角を含むエッジを分割する
    execution_timer_ins.start("🔁 split edge in turn")
    gdf_edges = split(gdf_edges)
    execution_timer_ins.stop()

    # 座標間の角度の変化量を求める(分割したのでもう一回実行)
    execution_timer_ins.start("📐 calc angle_deltas")
    gdf_edges["angle_deltas"] = column_generater.angle_deltas.generate(gdf_edges)
    execution_timer_ins.stop()

    # 基準に満たないエッジを削除する(分割したのでもう一回実行)
    execution_timer_ins.start("🗑️ remove below standard edge")
    count = len(gdf_edges)
    gdf_edges = remover.filter_edge.remove(gdf_edges)
    print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_edges)}")
    execution_timer_ins.stop()

    # 座標毎の標高値を求める
    tif_path = f"{os.path.dirname(os.path.abspath(__file__))}/../elevation.tif"
    execution_timer_ins.start("🏔️ calc elevation")
    gdf_edges["elevation"] = column_generater.elevation.generate(gdf_edges, tif_path)
    execution_timer_ins.stop()

    # 各ラインの最小標高値を求める
    execution_timer_ins.start("🏔️ calc min_elevation")
    gdf_edges["min_elevation"] = column_generater.min_elevation.generate_min_elevation(gdf_edges)
    execution_timer_ins.stop()

    # トンネルのデータを取得する
    execution_timer_ins.start("🗾 load osm tunnel data", ExecutionType.FETCH)
    graph_tunnel = graph_tunnel_feather.fetch_graph(search_area_polygon)
    in_tunnel = graph_tunnel is not None and len(graph_tunnel.edges) >= 1
    if in_tunnel:
        gdf_tunnel_edges = ox.graph_to_gdfs(graph_tunnel, nodes=False, edges=True)
    execution_timer_ins.stop()

    if in_tunnel:
        execution_timer_ins.start("🛣️ remove reverse tunnel edge")
        count = len(gdf_tunnel_edges)
        gdf_tunnel_edges = remover.reverse_edge.remove(gdf_tunnel_edges)
        print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_tunnel_edges)}")
        execution_timer_ins.stop()

        # トンネル内の標高を調整する
        execution_timer_ins.start("🏔️ calc elevation_tunnel_regulator")
        gdf_edges["elevation"] = column_generater.elevation_infra_regulator.generate(
            gdf_edges, gdf_tunnel_edges, column_generater.elevation_infra_regulator.InfraType.TUNNEL
        )
        execution_timer_ins.stop()

        # トンネルの距離を求める
        execution_timer_ins.start("🏔️ calc tunnel_length")
        gdf_edges["tunnel_length"] = column_generater.tunnel_length.generate(
            gdf_edges, gdf_tunnel_edges
        )
        execution_timer_ins.stop()
    
    # 橋のデータを取得する
    execution_timer_ins.start("🌉 load osm bridge data", ExecutionType.FETCH) 
    graph_bridge = graph_bridge_feather.fetch_graph(search_area_polygon)
    in_bridge = graph_bridge is not None and len(graph_bridge.edges) >= 1
    if in_bridge:
        gdf_bridge_edges = ox.graph_to_gdfs(graph_bridge, nodes=False, edges=True)
    execution_timer_ins.stop()

    if graph_bridge is not None:
        execution_timer_ins.start("🗑️ remove reverse edge")
        count = len(gdf_bridge_edges)
        gdf_bridge_edges = remover.reverse_edge.remove(gdf_bridge_edges)
        print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_bridge_edges)}")
        execution_timer_ins.stop()

        # 橋の標高を調整する
        execution_timer_ins.start("🌉 calc elevation_bridge_regulator")
        gdf_edges["elevation"] = column_generater.elevation_infra_regulator.generate(
            gdf_edges, gdf_bridge_edges, column_generater.elevation_infra_regulator.InfraType.BRIDGE
        )
        execution_timer_ins.stop()

    # 国の基準に合わせて傾斜を調整する
    execution_timer_ins.start("🏔️ calc elevation_adjuster")
    gdf_edges["elevation"] = column_generater.elevation_adjuster.generate(
        gdf_edges
    )
    execution_timer_ins.stop()

    # 標高の平準化を行う
    execution_timer_ins.start("🏔️ calc elevation_smooth")
    gdf_edges["elevation_smooth"] = column_generater.elevation_smooth.generate(
        gdf_edges
    )
    execution_timer_ins.stop()

    # 標高の高さ(最小値と最大値の差)を求める
    execution_timer_ins.start("🏔️ calc elevation_height")
    gdf_edges["elevation_height"] = column_generater.elevation_height.generate(
        gdf_edges
    )
    execution_timer_ins.stop()

    # 標高のアップダウン量を求める
    execution_timer_ins.start("🏔️ calc elevation_fluctuation")
    fluctuation_up, fluctuation_down = column_generater.elevation_fluctuation.generate(
        gdf_edges
    )
    gdf_edges["elevation_fluctuation"] = list(
        zip(fluctuation_up.round(2), fluctuation_down.round(2))
    )
    execution_timer_ins.stop()

    # 指定単位の標高の区間リストを生成する(z軸の凹凸の判定に使用)
    execution_timer_ins.start("🏔️ calc elevation_segment_list")
    gdf_edges["elevation_segment_list"] = column_generater.elevation_segment_list.generate(
        gdf_edges
    )
    execution_timer_ins.stop()

    # 指定単位の標高の区間リストを生成する(ジオメトリの座標リスト)
    if create_video:
        execution_timer_ins.start("🏔️ calc video_coords_segment_list")
        gdf_edges["video_coords_segment_list"] = column_generater.video_coords_segment_list.generate(
            gdf_edges
        )
        execution_timer_ins.stop()
    else:
        # 動画を作成しない場合は空リストを設定して重い処理をスキップ
        gdf_edges["video_coords_segment_list"] = [[] for _ in range(len(gdf_edges))]

    # 指定単位の標高の区間リストを生成する(ジオメトリの標高リスト)
    if create_video:
        execution_timer_ins.start("🏔️ calc video_elevation_segment_list")
        gdf_edges["video_elevation_segment_list"] = column_generater.video_elevation_segment_list.generate(
            gdf_edges
        )
        execution_timer_ins.stop()
    else:
        gdf_edges["video_elevation_segment_list"] = [[] for _ in range(len(gdf_edges))]

    # 上り下りのポイントを求める
    execution_timer_ins.start("🏔️ calc elevation_unevenness")
    elevation_unevenness = column_generater.elevation_unevenness.generate(
        gdf_edges
    )
    gdf_edges["elevation_unevenness"] = elevation_unevenness
    execution_timer_ins.stop()

    # 標高のバンプ数求める。
    execution_timer_ins.start("🏔️ calc elevation_unevenness_count")
    elevation_unevenness_count = column_generater.elevation_unevenness_count.generate(
        gdf_edges
    )
    gdf_edges["elevation_unevenness_count"] = elevation_unevenness_count
    execution_timer_ins.stop()

    execution_timer_ins.start("🛣️ calc width")
    if consider_gsi_width:
        # gsiの道幅を取得する
        avg_width, min_width = column_generater.width_gsi.generate(gdf_edges)
        gdf_edges["gsi_min_width"] = min_width
        gdf_edges["gsi_avg_width"] = avg_width
        execution_timer_ins.stop()

        # gsiの道幅が6m未満のエッジを削除する. 酷道は4~5m程度の道幅があり、地元の峠道は道幅が6.3mの道幅があるため。
        execution_timer_ins.start("🛣️ remove gsi_avg_width edge")
        count = len(gdf_edges)
        gdf_edges = gdf_edges[gdf_edges["gsi_avg_width"] >= 6]
        print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_edges)}")
        execution_timer_ins.stop()
    else:
        gdf_edges["gsi_min_width"] = 0
        gdf_edges["gsi_avg_width"] = 0
    # alpsmapの道幅を取得する
    execution_timer_ins.start("🛣️ calc alpsmap width")
    gdf_edges["is_alpsmap"] = column_generater.is_alpsmap.generate(gdf_edges)
    avg_width, min_width = column_generater.width_alpsmap.generate(gdf_edges)
    gdf_edges["alpsmap_min_width"] = min_width
    gdf_edges["alpsmap_avg_width"] = avg_width
    execution_timer_ins.stop()

    # 自作した位置データを取得のデータを取得
    execution_timer_ins.start("🛣️ fetch locations")
    gdf_edges['locations'] = column_generater.locations.generate(gdf_edges)
    execution_timer_ins.stop()

    # locationsをJSON形式に変換してlocations_jsonフィールドに追加
    execution_timer_ins.start("📊 create locations_json")
    gdf_edges['locations_json'] = gdf_edges['locations'].to_json(orient="records")
    execution_timer_ins.stop()

    # alpsmapの道幅が3m以下のエッジを削除する
    count = len(gdf_edges)
    execution_timer_ins.start("🛣️ remove alpsmap_min_width edge")
    gdf_edges = gdf_edges[
        ~((gdf_edges["is_alpsmap"] == 1) & (gdf_edges["alpsmap_min_width"] <= 3))
    ]
    print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_edges)}")
    execution_timer_ins.stop()

    # print(gdf_edges["geometry_list"].iloc[0])
    # print(gdf_edges["geometry"].iloc[0])

    # ステアリングホイールの角度を計算する
    execution_timer_ins.start("🛞 calc steering_wheel_angle")
    gdf_edges["steering_wheel_angle_info"] = column_generater.steering_wheel_angle.generate(
        gdf_edges
    )
    execution_timer_ins.stop()

    # ステアリングホイールの最大角度を計算する
    execution_timer_ins.start("🛞 calc steering_wheel_max_angle")
    gdf_edges["steering_wheel_max_angle"] = gdf_edges["steering_wheel_angle_info"].apply(
        lambda angle_info_list: max(item['steering_angle'] for item in angle_info_list) if angle_info_list else None
    )
    execution_timer_ins.stop()

    # ステアリングホイールの平均角度を計算する
    execution_timer_ins.start("🛞 calc steering_wheel_avg_angle")
    gdf_edges["steering_wheel_avg_angle"] = gdf_edges["steering_wheel_angle_info"].apply(
        lambda angle_info_list: sum(item['steering_angle'] for item in angle_info_list) / len(angle_info_list) if angle_info_list else None
    )
    execution_timer_ins.stop()
    
    # 道の区間情報を取得する
    execution_timer_ins.start("🛞 calc road_section")
    gdf_edges["road_section"] = column_generater.road_section.generate(
        gdf_edges
    )
    gdf_edges["road_section_cnt"] = gdf_edges["road_section"].apply(lambda x: len(x))
    execution_timer_ins.stop()

    # 道の区間数が少ないエッジを削除する
    execution_timer_ins.start("🛞 remove road_section_small_count")
    count = len(gdf_edges)
    gdf_edges = remover.remove_road_section_small_count.remove(gdf_edges)
    print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_edges)}")
    execution_timer_ins.stop()

    # コーナーがないエッジを削除する
    execution_timer_ins.start("🛞 remove no corner edge")
    count = len(gdf_edges)
    gdf_edges = gdf_edges[gdf_edges['road_section'].apply(lambda x: any(d.get('section_type') != 'straight' for d in x))]
    print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_edges)}")
    execution_timer_ins.stop()

    # 周辺の建物の数をカウント
    execution_timer_ins.start("🏚️ calc building_nearby_cnt")
    gdf_edges["building_nearby_cnt"] = column_generater.building_nearby_cnt.generate(gdf_edges)
    execution_timer_ins.stop()

    # スコアを求める
    execution_timer_ins.start("🏆 calc score")
    gdf_edges["score_elevation_unevenness"] = (
        column_generater.score_elevation_unevenness.generate(gdf_edges)
    )
    gdf_edges["score_elevation"] = column_generater.score_elevation.generate(gdf_edges)
    gdf_edges["score_length"] = column_generater.score_length.generate(gdf_edges)
    gdf_edges["score_width"] = column_generater.score_width.generate(gdf_edges)
    gdf_edges["score_center_line_section"] = column_generater.score_center_line_section.generate(gdf_edges)
    gdf_edges["score_claude_center_line_section"] = column_generater.score_claude_center_line_section.generate(gdf_edges)
    gdf_edges["score_claude_center_line_section_detail"] = gdf_edges["locations"].apply(
        lambda locs: sum(loc.get("claude_center_line_score") or 0 for loc in locs) / len(locs) if len(locs) > 0 else 0
    )
    # gdf_edges["score_width"] = 1
    score_corner_week, score_corner_medium, score_corner_strong, score_corner_none = column_generater.score_corner_level.generate(gdf_edges)
    gdf_edges["score_corner_week"] = score_corner_week
    gdf_edges["score_corner_medium"] = score_corner_medium
    gdf_edges["score_corner_strong"] = score_corner_strong
    gdf_edges["score_corner_none"] = score_corner_none
    gdf_edges["score_corner_balance"] = column_generater.score_corner_balance.generate(gdf_edges)
    gdf_edges["score_building"] = column_generater.score_building.generate(gdf_edges)
    gdf_edges["score_tunnel_outside"] = column_generater.score_tunnel_outside.generate(gdf_edges)

    gdf_edges["score"] = column_generater.score.generate(gdf_edges)
    execution_timer_ins.stop()

    # 低いスコアのデータを削除する
    execution_timer_ins.start("🛣️ remove low score")
    count = len(gdf_edges)
    gdf_edges = gdf_edges[gdf_edges["score"] >= 0.5]
    print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_edges)}")
    execution_timer_ins.stop()

    # geometry_check_list
    execution_timer_ins.start("🔗 create geometry_check_list")
    gdf_edges["geometry_check_list"] = column_generater.geometry_check_list.generate(
        gdf_edges
    )
    gdf_edges["street_view_url_list"] = gdf_edges["geometry_check_list"]
    execution_timer_ins.stop()

    # google earth urlを生成する
    execution_timer_ins.start("🔗 create google_earth_url")
    gdf_edges["google_earth_url"] = column_generater.google_earth_url.generate(
        gdf_edges
    )
    execution_timer_ins.stop()

    # street view urlを生成する
    execution_timer_ins.start("🔗 create street_view_url")
    gdf_edges["street_view_url"] = column_generater.street_view_url.generate(gdf_edges)
    execution_timer_ins.stop()

    # 地形データを出力する
    if create_terrain:
        execution_timer_ins.start("🏔️ write terrain_elevation file")
        gdf_edges["terrain_elevation_file_path"] = generate_file_path(gdf_edges, prefecture_code)
        write_terrain_elevations_file(gdf_edges, tif_path, plane_epsg_code)
        execution_timer_ins.stop()
    else:
        gdf_edges["terrain_elevation_file_path"] = ""

    # csvに変換して出力する
    output_columns = [
        "length",
        "highway",
        "street_view_url_list",
        "geometry_list",
        "geometry_check_list",
        "score",
        "lanes",
        "gsi_min_width",
        "gsi_avg_width",
        "is_alpsmap",
        "alpsmap_min_width",
        "alpsmap_avg_width",
        "locations",
        "locations_json"
    ]

    gdf_edges_balance = gdf_edges[(gdf_edges["score_corner_balance"] >= 0.5) & (gdf_edges['score_building'] >= 0.3)].sort_values("score", ascending=False).head(200)
    output_dir = f"{os.path.dirname(os.path.abspath(__file__))}/../html/standard.csv"
    gdf_edges_balance[output_columns].to_csv(output_dir, index=False)

    gdf_edges_week = gdf_edges[(gdf_edges["score_corner_week"] >= 0.35) & (gdf_edges["road_section_cnt"] >= 16) & (gdf_edges['score_building'] >= 0.3)].sort_values("score", ascending=False).head(200)
    output_dir = f"{os.path.dirname(os.path.abspath(__file__))}/../html/week_corner.csv"
    gdf_edges_week[output_columns].to_csv(output_dir, index=False)

    gdf_edges_medium = gdf_edges[(gdf_edges["score_corner_medium"] >= 0.2) & (gdf_edges['score_building'] >= 0.3)].sort_values("score", ascending=False).head(200)
    output_dir = f"{os.path.dirname(os.path.abspath(__file__))}/../html/medium_corner.csv"
    gdf_edges_medium[output_columns].to_csv(output_dir, index=False)

    gdf_edges_strong = gdf_edges[(gdf_edges["score_corner_strong"] >= 0.2) & (gdf_edges['score_building'] >= 0.3)].sort_values("score", ascending=False).head(200)
    output_dir = f"{os.path.dirname(os.path.abspath(__file__))}/../html/strong_corner.csv"
    gdf_edges_strong[output_columns].to_csv(output_dir, index=False)

    gdf_edges_elevation_unevenness = gdf_edges[(gdf_edges["elevation_unevenness_count"] >= 2) & (gdf_edges['score_building'] >= 0.3)].sort_values("elevation_unevenness_count", ascending=False).head(200)
    output_dir = f"{os.path.dirname(os.path.abspath(__file__))}/../html/elevation_unevenness.csv"
    gdf_edges_elevation_unevenness[output_columns].to_csv(output_dir, index=False)
    execution_timer_ins.finish()

    # gdf_edgesをscoreの大きい順に並び替える
    gdf_edges = gdf_edges.sort_values("score", ascending=False)

    # jsonに変換して出力する
    output_columns = [
        "length",
        "highway",
        "name",
        "geometry_list",
        "geometry_meter_list",
        "elevation_height",
        "elevation_smooth",
        "elevation_segment_list",
        "elevation_unevenness",
        "elevation_unevenness_count",
        "video_coords_segment_list",
        "video_elevation_segment_list",
        "angle_deltas",
        "score_elevation",
        "score_elevation_unevenness",
        "score_width",
        "score_length",
        "score_corner_week",
        "score_corner_medium",
        "score_corner_strong",
        "score_corner_none",
        "score_corner_balance",
        "score_building",
        "score_tunnel_outside",
        "score_center_line_section",
        "score_claude_center_line_section",
        "score_claude_center_line_section_detail",
        "google_earth_url",
        "street_view_url",
        "lanes",
        "turn_points",
        "road_section",
        "tunnel",
        "bridge",
        "steering_wheel_angle_info",
        "steering_wheel_max_angle",
        "steering_wheel_avg_angle",
        # "locations",
        "building_nearby_cnt",
        "road_section_cnt",
        "tunnel_length",
        "terrain_elevation_file_path",
        "min_elevation",
        "geometry_check_list"
    ]

    output_dir = f"{os.path.dirname(os.path.abspath(__file__))}/../html/targets/{prefecture_code}/target.json"
    os.makedirs(os.path.dirname(output_dir), exist_ok=True)
    print(output_dir)
    gdf_edges[output_columns].to_json(output_dir, orient="records")

    output_dir_bk = f"{os.path.dirname(os.path.abspath(__file__))}/../html/json_bk/{datetime.now().strftime('%Y-%m-%d-%H-%M')}.json"
    os.makedirs(os.path.dirname(output_dir_bk), exist_ok=True)
    gdf_edges[output_columns].to_json(output_dir_bk, orient="records")

    return gdf_edges
