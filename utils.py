import osmnx as ox
from networkx import Graph
import folium
import pandas as pd
import numpy as np

# グラフから指定した位置情報に近いノードを抽出する
def extract_nearest_node_from_graph(graph: Graph, latitude: int, longitude: int):
  node = ox.distance.nearest_nodes(
      graph, longitude, latitude, return_dist=False
  )
  return node

# 指定ノードに色をつけてグラフを描画する
def highlight_node(graph: Graph, highlight_node: int):
  node_colors = ['red' if node == highlight_node else 'blue' for node in graph.nodes]
  ox.plot_graph(graph, node_color=node_colors)
  
# gdf_edgesから指定したmultiindexの行を削除する
def drop_multiindex_row(gdf, multiindex):
    # indexが存在しない場合はなにもしない
    if gdf.index.isin(multiindex).any():
        return gdf.drop(gdf.loc[multiindex].index)
    else:
        return gdf

# エッジから重複(逆方向のエッジ)を削除する
def drop_duplicate_edge(gdf_edges):
  droped_index = []
  for index, row in gdf_edges.iterrows():
      # drop_indexにindex[1], index[0]が存在する場合はなにもしない
      if (index[1], index[0]) in droped_index:
          continue
      if (index[0], index[1]) in droped_index:
          continue
      gdf_edges = drop_multiindex_row(gdf_edges, [(index[1], index[0], 0)])
      droped_index.append((index[1], index[0]))
  return gdf_edges