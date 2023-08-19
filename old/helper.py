import osmnx as ox
import folium
import geopandas as gpd

# 指定した緯度と経度に最も近いノードを取得
def get_nearest_node_by_coordinates(graph, latitude, longitude):
    nearest_node = ox.distance.nearest_nodes(
        graph, longitude, latitude, return_dist=False
    )
    return nearest_node