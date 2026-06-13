from geopandas import GeoDataFrame
from pandas import Series
from geopy.distance import geodesic

# トンネルの距離を計算する
def generate(gdf: GeoDataFrame, tunnel_edge_gdf: GeoDataFrame) -> Series:
    def func(row):
        target_tunnel_edges = get_tunnel_edges(row, tunnel_edge_gdf)
        if target_tunnel_edges is None:
            return 0
        # 距離をmで計算
        total_distance = 0
        for i, tunnel_edge in target_tunnel_edges.iterrows():
            coords = list(tunnel_edge.geometry.coords)
            for i in range(1, len(coords)):
                total_distance += geodesic(reversed(coords[i-1]), reversed(coords[i])).meters
        return total_distance

    results = gdf.apply(func, axis=1)
    return results

# elevation_adjuster.pyのコピー。そのうち共通化する
def get_tunnel_edges(row, tunnel_edge_gdf: GeoDataFrame) -> GeoDataFrame | None:
    base_edge_coords = list(row.geometry.coords)
    tunnel_edges_sindex = tunnel_edge_gdf["geometry"].sindex
    tunnel_edge_in_bbox_index_list = list(tunnel_edges_sindex.intersection(row.geometry.bounds))
    tunnel_edges_in_bbox = tunnel_edge_gdf.iloc[tunnel_edge_in_bbox_index_list]
    target_tunnel_index_list = []
    for idx, tunnel_edge in tunnel_edges_in_bbox.iterrows():
        num_match_coords = sum([1 for coord in tunnel_edge.geometry.coords if coord in base_edge_coords])
        if num_match_coords >= 2:
            target_tunnel_index_list.append(idx)
    if len(target_tunnel_index_list) == 0:
        return None
    target_tunnel_edges = tunnel_edges_in_bbox.loc[target_tunnel_index_list]
    return target_tunnel_edges