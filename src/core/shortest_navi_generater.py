import osmnx as ox
from geopandas import GeoDataFrame
from networkx import Graph
from geopy.distance import geodesic


def generate(
    latitude_start: float,
    longitude_start: float,
    latitude_end: float,
    longitude_end: float,
    graph: Graph,
    gdf: GeoDataFrame,
    point_num: int,
):
    # キャッシュを使う
    ox.settings.use_cache = True
    ox.settings.log_console = False
    g_all = ox.graph_from_bbox(
        north=max(latitude_start, latitude_end),
        south=min(latitude_start, latitude_end),
        east=max(longitude_start, longitude_end),
        west=min(longitude_start, longitude_end),
        network_type="drive",
        simplify=False,
        retain_all=True,
        custom_filter='["toll"!~"yes"]',
    )

    gdf_edges = (
        gdf.sort_values("score_normalization", ascending=False).head(point_num).copy()
    )
    current_location = (35.352738, 136.922609)

    gdf_edges["center_point"] = gdf_edges["geometry"].apply(
        lambda x: x.coords[len(x.coords) // 2]
    )

    points = {"CURRENT": current_location}
    edges = {"CURRENT": [current_location, current_location]}
    cnt = 0
    for index, row in gdf_edges.iterrows():
        edge_name = chr(cnt + 65)
        cnt += 1
        # geometryの中央の値をtupleで取得する
        points[edge_name] = (row.center_point[1], row.center_point[0])
        edges[edge_name] = [
            (row.start_point[1], row.start_point[0]),
            (row.end_point[1], row.end_point[0]),
        ]

    two_node_distances = {}
    routes = {}

    def calculate_route_distance(route):
        total_distance = 0
        for i in range(len(route) - 1):
            node_start = ox.nearest_nodes(
                graph, points[route[i]][1], points[route[i]][0]
            )
            node_end = ox.nearest_nodes(
                graph, points[route[i + 1]][1], points[route[i + 1]][0]
            )
            print(f"{route[i]} -->{route[i + 1]}")
            if f"{node_start}_{node_end}" not in routes:
                shortest_route = ox.shortest_path(g_all, node_start, node_end)
                routes[f"{node_start}_{node_end}"] = shortest_route
                routes[f"{node_end}_{node_start}"] = shortest_route

            shortest_route = routes[f"{node_start}_{node_end}"]
            if shortest_route != None:
                if f"{node_start}_{node_end}" not in two_node_distances:
                    # print("new")
                    gdf = ox.utils_graph.route_to_gdf(g_all, shortest_route, "length")
                    length_total = gdf["length"].sum()
                    total_distance += length_total
                    two_node_distances[f"{node_start}_{node_end}"] = length_total
                    two_node_distances[f"{node_end}_{node_start}"] = length_total
                else:
                    total_distance += two_node_distances[f"{node_start}_{node_end}"]
            else:
                # print(f"None")
                pass
        return total_distance

    def two_opt_swap(route, i, k):
        new_route = route[:i]
        new_route.extend(reversed(route[i : k + 1]))
        new_route.extend(route[k + 1 :])
        return new_route

    def two_opt(route):
        improvement = True
        while improvement:
            improvement = False
            for i in range(1, len(route) - 2):
                for k in range(i + 1, len(route) - 1):
                    new_route = two_opt_swap(route, i, k)
                    if calculate_route_distance(new_route) < calculate_route_distance(
                        route
                    ):
                        route = new_route
                        improvement = True
        return route

    initial_route = list(points.keys())[1:]
    initial_route = ["CURRENT"] + initial_route + ["CURRENT"]

    optimized_route = two_opt(initial_route)

    print(optimized_route)

    # optimized_routeの緯度と経度を出力する
    for i in range(1, len(optimized_route) - 1):
        now_name = optimized_route[i]
        now_st_point = edges[now_name][0]
        now_ed_point = edges[now_name][1]
        # print(
        #     f"name: {now_name} st: {now_st_point[0]},{now_st_point[1]}, ed: {now_ed_point[0]},{now_ed_point[1]}"
        # )

    routes_seikika = [current_location]
    # routes_seikikaの頭とけつをのぞいたものをループさせる
    for i in range(1, len(optimized_route) - 1):
        before_name = optimized_route[i - 1]
        now_name = optimized_route[i]
        after_name = optimized_route[i + 1]
        before_point = points[before_name]
        now_st_point = edges[now_name][0]
        now_ed_point = edges[now_name][1]
        after_point = points[after_name]
        # before_point→now_st_point→now_ed_point→after_pointまでの距離を計算する
        distance_one = (
            geodesic(before_point, now_st_point).kilometers
            + geodesic(now_st_point, now_ed_point).kilometers
            + geodesic(now_ed_point, after_point).kilometers
        )

        distance_two = (
            geodesic(before_point, now_ed_point).kilometers
            + geodesic(now_ed_point, now_st_point).kilometers
            + geodesic(now_st_point, after_point).kilometers
        )

        # print(distance_one)
        # print(distance_two)
        if distance_one < distance_two:
            routes_seikika.append(now_st_point)
            routes_seikika.append(now_ed_point)
        if distance_one > distance_two:
            routes_seikika.append(now_ed_point)
            routes_seikika.append(now_st_point)
    routes_seikika.append(current_location)

    print(routes_seikika)

    # Base URL for Google Maps directions
    base_url = "https://www.google.com/maps/dir/"

    # routes_seikikaの頭とけつをのぞいたものを取得
    route_coordinates = routes_seikika[1:-1]
    route_url = base_url + "/".join([f"{lat},{lon}" for lat, lon in routes_seikika])
    print(route_url)

    # # route_coordinatesを10単位でループする。22の場合は3回
    # for i in range(0, len(route_coordinates), 10):
    #     target = route_coordinates[i : i + 10]
    #     if i == 0:
    #         target.insert(0, current_location)
    #     if len(route_coordinates) < 11:
    #         # 先頭に直前のループした終点を追加する
    #         target.insert(0, routes_seikika[i - 1])
    #         target.append(current_location)
    #     route_url = base_url + "/".join([f"{lat},{lon}" for lat, lon in target])
    #     print(route_url)
