import osmnx as ox
import networkx as nx


def fetch_graph(
    latitude_start, longitude_start, latitude_end, longitude_end
) -> nx.Graph:
    # キャッシュを使う
    ox.settings.use_cache = True
    ox.settings.log_console = False
    # 道幅用のタグを追加
    ox.settings.useful_tags_way += ["yh:WIDTH"] + ["source"]

    graph = ox.graph_from_bbox(
        north=max(latitude_start, latitude_end),
        south=min(latitude_start, latitude_end),
        east=max(longitude_start, longitude_end),
        west=min(longitude_start, longitude_end),
        network_type="drive",
        simplify=True,
        retain_all=True,
        custom_filter='["highway"~"secondary|secondary_link|primary|primary_link|trunk|trunk_link|tertiary"]["lanes"!=1]',
    )
    return graph
