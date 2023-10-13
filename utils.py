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

# エッジから重複(逆方向のエッジ)を削除する
def drop_reverse_edge(gdf_edges):
  drop_target = []
  for index, row in gdf_edges.iterrows():
      # drop_indexにindex[1], index[0]が存在する場合はなにもしない
      if (index[1], index[0], 0) in drop_target:
          continue
      if (index[0], index[1], 0) in drop_target:
          continue
      drop_target.append(index)
  result = gdf_edges[gdf_edges.index.isin(drop_target)]
  return result