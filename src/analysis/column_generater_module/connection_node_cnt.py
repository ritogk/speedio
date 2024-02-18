from geopandas import GeoDataFrame
from pandas import Series
import osmnx as ox

from tqdm import tqdm


# エッジ内の分岐数を取得する
def generate(
    gdf: GeoDataFrame, latitude_start, longitude_start, latitude_end, longitude_end
) -> Series:
    ox.settings.use_cache = True
    ox.settings.log_console = False

    # エッジに含まれるノードを取得する
    graph_all = ox.graph_from_bbox(
        north=max(latitude_start, latitude_end),
        south=min(latitude_start, latitude_end),
        east=max(longitude_start, longitude_end),
        west=min(longitude_start, longitude_end),
        network_type="drive",
        simplify=True,
        retain_all=True,
    )
    all_nodes = ox.graph_to_gdfs(graph_all, nodes=True, edges=False)

    def func(row):
        # ジオメトリーの座標と一致するノードを取得する
        nodes = all_nodes[all_nodes.geometry.intersects(row.geometry)]
        # 進行方向と逆方向のノードを除外して分岐数を計算する
        result = nodes["street_count"].sum() - (len(nodes) * 2)
        return result

    tqdm.pandas()
    series = gdf.progress_apply(func, axis=1)

    return series
