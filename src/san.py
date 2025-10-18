import pandas as pd
from pyproj import Proj, Transformer
from analysis import graph_tunnel_feather, graph_bridge_feather, column_generater, remover
import osmnx as ox
from core.execution_timer import ExecutionTimer, ExecutionType

# === 設定 ===
csv_path = r"./gps_records_363.csv"
output_path = r"./gps_records_plane.csv"

# === 変換したい平面直角座標系のEPSGコードを指定 ===
# 例: 第7系 → EPSG:6676, 第9系 → EPSG:6678
PLANE_EPSG = 2449   # ←ここを必要な系に変更

# === Transformer（緯度経度 → 平面直角座標） ===
wgs84 = Proj('epsg:4326')  # WGS84（GPSの座標系）
japan_plane = Proj(f'epsg:{PLANE_EPSG}')  # 日本の平面直角座標系
transformer = Transformer.from_proj(wgs84, japan_plane, always_xy=True)

# === CSV読み込み ===
df = pd.read_csv(csv_path)

# latitude, longitude という列名を想定
if not {'latitude', 'longitude'}.issubset(df.columns):
    raise ValueError("CSVに 'latitude', 'longitude' 列が必要です。")

# === 座標変換 ===
from analysis.column_generater_module.elevation import elevation_service

# 標高データのtifファイルパス（必要に応じて修正）
TIF_PATH = '../elevation.tif'
elevation_service_ins = elevation_service.ElevationService(TIF_PATH)

def to_plane_coords(row):
    lon, lat = row['longitude'], row['latitude']
    x, y = transformer.transform(lon, lat)
    # 標高値を取得
    elevation = elevation_service_ins.get_elevation(lat, lon)
    return pd.Series({'x': int(x), 'y': int(y), 'z': elevation})

converted = df.apply(to_plane_coords, axis=1)

# 標高値を調整
# トンネルのデータを取得する
graph_tunnel = graph_tunnel_feather.fetch_graph(search_area_polygon)
in_tunnel = graph_tunnel is not None and len(graph_tunnel.edges) >= 1
if in_tunnel:
    gdf_tunnel_edges = ox.graph_to_gdfs(graph_tunnel, nodes=False, edges=True)

if in_tunnel:
    count = len(gdf_tunnel_edges)
    gdf_tunnel_edges = remover.reverse_edge.remove(gdf_tunnel_edges)
    print(f"  📑 row: {count}, 🗑️ deleted: {count - len(gdf_tunnel_edges)}")

    # トンネル内の標高を調整する
    gdf_edges["elevation"] = column_generater.elevation_infra_regulator.generate(
        gdf_edges, gdf_tunnel_edges, column_generater.elevation_infra_regulator.InfraType.TUNNEL
    )

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

# === 元のデータと結合 ===
df = pd.concat([df, converted], axis=1)

# === 結果をCSV出力 ===
df.to_csv(output_path, index=False, encoding='utf-8-sig')

print(f"変換完了！出力: {output_path}")
