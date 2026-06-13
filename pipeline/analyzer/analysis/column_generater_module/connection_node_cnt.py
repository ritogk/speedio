from geopandas import GeoDataFrame
from pandas import Series
import osmnx as ox
import networkx as nx
from tqdm import tqdm


# エッジ内の分岐数を取得する
def generate(gdf: GeoDataFrame, graph: nx.Graph) -> Series:
    ox.settings.use_cache = True
    ox.settings.log_console = False

    all_nodes = ox.graph_to_gdfs(graph, nodes=True, edges=False)
    sindex_nodes = all_nodes.sindex

    def func(row):
        # ジオメトリーの境界ボックス内のノードのインデックスを取得
        sindex_matche_indexs = list(sindex_nodes.intersection(row.geometry.bounds))
        # インデックスをNodeに変換
        sindex_matche_nodes = all_nodes.iloc[sindex_matche_indexs]

        # 境界ボックス内のノードの中で実際に交差するノードを取得。boudary内のノードから絞り込むのでめっちゃはやい。
        matche_nodes = sindex_matche_nodes[sindex_matche_nodes.intersects(row.geometry)]

        # 進行方向と逆方向のノードを除外して分岐数を計算
        result = matche_nodes["street_count"].sum() - (len(matche_nodes) * 2)
        return result

    tqdm.pandas()
    series = gdf.progress_apply(func, axis=1)

    return series
