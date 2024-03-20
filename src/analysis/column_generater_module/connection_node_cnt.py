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

    def func(row):
        # ジオメトリーの座標と一致するノードを取得する
        nodes = all_nodes[all_nodes.geometry.intersects(row.geometry)]
        # 進行方向と逆方向のノードを除外して分岐数を計算する
        result = nodes["street_count"].sum() - (len(nodes) * 2)
        return result

    tqdm.pandas()
    series = gdf.progress_apply(func, axis=1)

    return series
