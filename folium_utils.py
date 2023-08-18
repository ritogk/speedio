import osmnx as ox
from networkx import Graph
import folium
import pandas as pd
import numpy as np

# マーカーを追加する
def add_marker(map: folium.Map, latitude: int, longitude: int, text: str, color: str):
  folium.Marker(
      location=[latitude, longitude],
      popup=text,
      icon=folium.Icon(color=color, icon='ok-sign'),
  ).add_to(map)