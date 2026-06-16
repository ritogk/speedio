import osmnx as ox
import networkx as nx
from shapely.geometry import MultiPolygon
from .overpass_fallback import call_with_fallback

def fetch_graph(
    search_area_polygon : MultiPolygon,
) -> nx.Graph:
    ox.settings.use_cache = True
    ox.settings.log_console = False
    ox.settings.useful_tags_way += ["yh:WIDTH"] + ["source"] + ["tunnel"] + ["bridge"]

    return call_with_fallback(
        ox.graph_from_polygon,
        search_area_polygon,
        network_type="drive",
        simplify=True,
        retain_all=True,
        custom_filter='["highway"~"secondary|secondary_link|primary|primary_link|trunk|trunk_link|tertiary"]["lanes"!=1]',
    )
