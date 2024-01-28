import osmnx as ox

# # 指定された緯度経度の範囲
# north, south, east, west = (
#     35.69745580725804,
#     35.6929946320988,
#     139.76806640625,
#     139.7625732421875,
# )

# # 指定された境界ボックス内の道路ネットワークを取得
# graph = ox.graph_from_bbox(north, south, east, west, network_type="drive")

# 墨田区と台東区の名前をリストで指定
places = ["Sumida, Tokyo, Japan", "Taito, Tokyo, Japan"]

# 指定された地域の道路ネットワークを取得
graph = ox.graph_from_place(places, network_type="drive", simplify=False)

# エッジのデータをGeoDataFrameとして取得
edges = ox.graph_to_gdfs(graph, nodes=False)

for column in edges.columns:
    if edges[column].apply(lambda x: isinstance(x, list)).any():
        edges[column] = edges[column].astype(str)

# GeoDataFrameをファイルに保存（ここではGeoJSON形式を使用）
edges.to_file("kyoto_roads.geojson", driver="GeoJSON")
