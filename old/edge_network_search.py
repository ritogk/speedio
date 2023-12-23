import osmnx as ox
import folium
import geopandas as gpd
from typing import List

class EdgeNetworkSearch:
  _max_distance = 1000
  def __init__(self, start_edge: gpd.GeoSeries, edges: gpd.GeoDataFrame):
    self._edges = edges
    self._searched_lines = []
    self._searching_line = {'total_distance': start_edge.length, 'ref': start_edge.ref, 'connected_edges': [start_edge] }
  
  # 探索開始
  def start(self):
    # print(self._searching_line)
    self._searched_lines, self._searching_line = self.search(self._searched_lines, self._searching_line)
    print(self._searched_lines)
    a = 1

  # 探索
  def search(self, lines, line):
    # lineのconnected_edgesの最後のエッジを取得
    line_last_edge: gpd.GeoSeries = line['connected_edges'][-1]
    
    line_st_node = line_last_edge.name[0]
    line_ed_node = line_last_edge.name[1]
    print('st_node: ', line_st_node, 'ed_node: ', line_ed_node)
    
    if((line_st_node == 1137158316) & (line_ed_node == 1137158372)):
      a = 1
    
    # 終了ノードを開始ノードに含むエッジを取得。ただし、探索済のエッジは除外する
    edges = self.get_unsearch_edges(lines, line, line_st_node, line_ed_node)
      
    for index, edge in edges.iterrows():
      if(edge.ref == None):
        continue
      # 対象エッジが存在しない場合はラインを確定させる
      if(len(line['connected_edges']) == 0):
        line['connected_edges'].append(edge)
        line = {'total_distance': edge.length, 'ref': edge.ref, 'connected_edges': [edge] }
        lines, line = self.search(lines, line)
        continue
      # 指定距離を超えたらラインを確定させる
      if(line['total_distance'] > self._max_distance):
          lines.append(line)
          line = {'total_distance': 0, 'ref': 0, 'connected_edges': [] }
          print('change line')
          continue
          
      # 路線番号が同じ場合はラインの繋がりとして認める
      if(edge.ref == line['ref']):
          line['total_distance'] += edge.length
          line['connected_edges'].append(edge)
          # print(line)
      st_node = edge.name[0]
      ed_node = edge.name[1]
      # 探索しているエッジの終了ノードを開始ノードに含むエッジが存在する
      connected_edges = self.get_unsearch_edges(lines, line, st_node, ed_node)
      if(len(connected_edges) > 0):
        lines, line = self.search(lines, line)
      else:
        # 路線番号が同じエッジが存在しない場合はラインを確定させる。
        lines.append(line)
        line = {'total_distance': 0, 'ref': 0, 'connected_edges': [] }
        print('change line')
        continue
    
    
    
    
    # 終了ノードを開始ノードに含むエッジを取得。ただし、探索済のエッジは除外する
    edges = self.get_unsearch_edges(lines, line, line_ed_node, line_st_node)
      
    for index, edge in edges.iterrows():
      # 対象エッジが存在しない場合はラインを確定させる
      if(len(line['connected_edges']) == 0):
        line['connected_edges'].append(edge)
        line = {'total_distance': edge.length, 'ref': edge.ref, 'connected_edges': [edge] }
        lines, line = self.search(lines, line)
        continue
      # 指定距離を超えたらラインを確定させる
      if(line['total_distance'] > self._max_distance):
          lines.append(line)
          line = {'total_distance': 0, 'ref': 0, 'connected_edges': [] }
          print('change line')
          continue
          
      # 路線番号が同じ場合はラインの繋がりとして認める
      if(edge.ref == line['ref']):
          line['total_distance'] += edge.length
          line['connected_edges'].append(edge)
          # print(line)
      st_node = edge.name[0]
      ed_node = edge.name[1]
      # 探索しているエッジの終了ノードを開始ノードに含むエッジが存在する
      connected_edges = self.get_unsearch_edges(lines, line, st_node, ed_node)
      if(len(connected_edges) > 0):
        lines, line = self.search(lines, line)
      else:
        # 路線番号が同じエッジが存在しない場合はラインを確定させる。
        lines.append(line)
        line = {'total_distance': 0, 'ref': 0, 'connected_edges': [] }
        print('change line')
        continue
    return lines, line
    
  # 指定したrefのエッジを先頭に来るように並び替える
  def sort_edge_by_ref(self, edges: gpd.GeoSeries, ref):
    if(len(edges) == 0):
      return edges
    # オブジェクトのエラー対応もしないと・・・・
    edges.loc[(edges == ref)] = 0
    edges.loc[ edges != 0] = 1
    return edges
  
  # 指定のノードを開始ノードに含むエッジを取得。ただし、探索済のエッジは除外する
  def get_unsearch_edges(self, lines, line, st_node, ed_node):
    # エッジを抽出
    edges = self._edges.loc[(self._edges.index.get_level_values(0) == ed_node)]
    
    # 探索済のエッジを除外する
    filter_condition = []
    for index, edge in edges.iterrows():
      if(self.is_include_connected_edges(lines, line, edge.name[0], edge.name[1])):
        filter_condition.append(False)
      else:
        filter_condition.append(True)
    edges =  edges[filter_condition]
  
    # 探索中の路線番号が先頭に来るようにソート
    edges = edges.sort_values('ref', key=lambda x: self.sort_edge_by_ref(x, line['ref']))
    return edges
  
  # 指定したエッジが探索済エッジに含まれているかチェック
  def is_include_connected_edges(self, lines, line, st_node, ed_node):
    # 逆方向とエッジと正方向のエッジ両方に含まれていない事
    for y in line['connected_edges']:
      z: gpd.GeoSeries = y
      # 正方向
      if (z.name[0] == st_node) & (z.name[1] == ed_node):
        return True
      # 逆方向
      if (z.name[0] == ed_node) & (z.name[1] == st_node):
        return True
    for x in lines:
      for y in x['connected_edges']:
        z: gpd.GeoSeries = y
        if (z.name[0] == st_node) & (z.name[1] == ed_node):
          return True
        if (z.name[0] == ed_node) & (z.name[1] == st_node):
          return True
    return False
  
  # エッジに隣接するエッジを取得
  def get_adjacent_edges(self, edge: gpd.GeoSeries):
    pass