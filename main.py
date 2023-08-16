import osmnx as ox
import folium
import geopandas as gpd
from typing import List
import helper
from edge_network_search import EdgeNetworkSearch

def main():
  latitude = 35.334446
  longitude = 136.990590
  # 指定範囲のエッジとノードを取得
  graph = ox.graph_from_point(center_point=(latitude, longitude)
                                  , network_type='drive'
                                  , dist=3000
                                  , simplify=True
                                  , custom_filter='["highway"~"tertiary|secondary|primary"]')
  # グラフデータをpandasのdataFrame形式に変換
  gdf_nodes = ox.graph_to_gdfs(graph, nodes=True, edges=False)
  gdf_edges = ox.graph_to_gdfs(graph, nodes=False, edges=True)

  # 中央付近のノードを取得
  center_node = helper.get_nearest_node_by_coordinates(graph, latitude, longitude)
  print('center_node: ', center_node)
  
  # ノードを含むエッジを取得
  edges = gdf_edges.loc[(gdf_edges.index.get_level_values(0) == center_node)]
  start_edge = edges.iloc[0]

  lines = []
  line = {'total_distance': start_edge.length, 'ref': start_edge.ref, 'connected_edges': [start_edge] }

  edge_network_search = EdgeNetworkSearch(start_edge, gdf_edges)
  edge_network_search.search(lines, line)
  edge_network_search.start()

    
if __name__ == '__main__':
  main()