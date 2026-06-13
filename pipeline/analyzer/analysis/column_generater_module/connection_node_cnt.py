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

    # numpy配列で直接参照（元のiloc+DataFrame生成のオーバーヘッドを回避）
    all_geoms = all_nodes.geometry.values
    all_street_counts = all_nodes["street_count"].values

    def func(row):
        idxs = list(sindex_nodes.intersection(row.geometry.bounds))
        count = 0
        n_matches = 0
        for idx in idxs:
            if all_geoms[idx].intersects(row.geometry):
                count += all_street_counts[idx]
                n_matches += 1
        return count - (n_matches * 2)

    tqdm.pandas()
    series = gdf.progress_apply(func, axis=1)

    return series
