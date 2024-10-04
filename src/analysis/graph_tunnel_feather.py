import osmnx as ox
import networkx as nx
from typing import Union
from shapely.geometry import MultiPolygon

# トンネルの情報を取得する
def fetch_graph(
    search_area_polygon : MultiPolygon,
) -> Union[nx.Graph, None]:
    # キャッシュを使う
    ox.settings.use_cache = True
    ox.settings.log_console = False
    # # 道幅用のタグを追加
    # ox.settings.useful_tags_way += ["yh:WIDTH"] + ["source"] + ["tunnel"]
    try:
        graph = ox.graph_from_bbox(
            search_area_polygon,
            network_type="drive",
            simplify=True,
            retain_all=True,
            custom_filter='["highway"~"secondary|secondary_link|primary|primary_link|trunk|trunk_link|tertiary"]["lanes"!=1]["tunnel"="yes"]',
        )

        return graph
    except Exception as e:
        # print(e)
        return None
