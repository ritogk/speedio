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

import pandas as pd
import geopandas as gpd
from shapely.geometry import LineString

import pandas as pd
from pyproj import Proj, Transformer


from .core.terrain_elevation_generator import write_terrain_elevations_file, generate_file_path

# 指定したポリゴン内を対象に処理を行う。
def main(search_area_polygon:Polygon|MultiPolygon, plane_epsg_code:str, prefecture_code:str, coords: list) -> GeoDataFrame:
    env = getEnv()
    consider_gsi_width = env["CONSIDER_GSI_WIDTH"]

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
    
    # gdf_edgesがemptyの場合は終了する
    if gdf_edges.empty:
        return gdf_edges
    
    # 先頭のエッジのgeometryを更新する
    # coordsはtimestamp,latitude,longitudeのcsv
    # LineStringを生成
    line = LineString(coords)
    gdf_edges.iloc[0, gdf_edges.columns.get_loc("geometry")] = line

    # gdf_edgesを先頭1行だけにする
    gdf_edges = gdf_edges.iloc[[0]]

    # 座標毎の標高値を求める
    tif_path = f"{os.path.dirname(os.path.abspath(__file__))}/../elevation.tif"
    execution_timer_ins.start("🏔️ calc elevation")
    gdf_edges["elevation"] = column_generater.elevation.generate(gdf_edges, tif_path)
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

    # 平面直角座標の項目を作成
    PLANE_EPSG = 2449   # ←ここを必要な系に変更
    # === Transformer（緯度経度 → 平面直角座標） ===
    wgs84 = Proj('epsg:4326')  # WGS84（GPSの座標系）
    japan_plane = Proj(f'epsg:{PLANE_EPSG}')  # 日本の平面直角座標系
    transformer = Transformer.from_proj(wgs84, japan_plane, always_xy=True)

    def to_plane_coords(row):
        geom = row["geometry"]
        if geom is None or geom.is_empty:
            return pd.Series({"x": [], "y": []})

        xs, ys = [], []
        # LineStringの全座標を走査
        for lon, lat in geom.coords:
            x, y = transformer.transform(lon, lat)
            xs.append(x)
            ys.append(y)

        return pd.Series({"x": xs, "y": ys})

    gdf_edges[['x', 'y']] = gdf_edges.apply(to_plane_coords, axis=1)
    # latitude, longitude という列名を作成
    gdf_edges["latitude"] = gdf_edges["geometry"].apply(lambda geom: [y for x, y in geom.coords])
    gdf_edges["longitude"] = gdf_edges["geometry"].apply(lambda geom: [x for x, y in geom.coords])

    return gdf_edges
