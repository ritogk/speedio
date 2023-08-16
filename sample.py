import osmnx as ox
import folium

# 峠道
graph = ox.graph_from_point(center_point=(35.334446, 136.990590)
                                , network_type='drive'
                                , dist=1000
                                , simplify=True
                                , custom_filter='["highway"~"tertiary|secondary|primary"]')

# グラフデータをGeoDataFrameに変換
gdf_nodes = ox.graph_to_gdfs(graph, nodes=True, edges=False)
gdf_edges = ox.graph_to_gdfs(graph, nodes=False, edges=True)

def find_node(node_id):
    return gdf_nodes[gdf_nodes['osmid'] == node_id]