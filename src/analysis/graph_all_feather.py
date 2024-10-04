import osmnx as ox
import networkx as nx
from shapely.geometry import MultiPolygon

def fetch_graph(search_area_polygon : MultiPolygon) -> nx.Graph:
    # キャッシュを使う
    ox.settings.use_cache = True
    ox.settings.log_console = False

    graph = ox.graph_from_polygon(
        search_area_polygon,
        network_type="drive",
        simplify=True,
        retain_all=True,
    )

    return graph
