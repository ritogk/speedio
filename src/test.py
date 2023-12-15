from .core.logger import logger

# analysis.remover.reverse_edgeをインポート
import osmnx as ox
from geopandas import GeoDataFrame


def main() -> GeoDataFrame:
    # 自宅周辺の軽いデータ
    latitude_start = 35.330878
    longitude_start = 136.951774
    latitude_end = 35.402261
    longitude_end = 137.072889

    logger = Logger()

    logger.output_st("## [st]loading openstreetmap data")
    graph = fetch_graph(latitude_start, longitude_start, latitude_end, longitude_end)
    logger.output_ed("## [ed]load openstreetmap data")

    logger.output_st("## [st]convert graph to GeoDataFrame")
    gdf_edges = ox.graph_to_gdfs(graph, nodes=False, edges=True)
    logger.output_ed("## [ed]convert graph to GeoDataFrame")

    logger.output_st("## [st]delete reverse edge")
    gdf_edges = reverse_edge.delete(gdf_edges)
    logger.output_ed("## [ed]delete reverse edge")

    # 開始位置列を追加する
    gdf = add_coluumns(gdf_edges)

    return gdf
