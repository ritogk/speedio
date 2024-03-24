from geopandas import GeoDataFrame
import shapely as sp
import pyproj as proj


def split(gdf: GeoDataFrame) -> GeoDataFrame:
    base_gdf = gdf.copy()
    for index, row in base_gdf.iterrows():
        turn_points = list(row.turn_points)
        if len(row.turn_points) == 0:
            continue
        # geometryを曲がり角のポイント毎に分割する
        geometrys = []
        coords = list(row.geometry.coords)
        cut_start = 0
        cut_end = 0
        for coord_i, coord in enumerate(coords):
            cut_end = coord_i + 1
            for turn_point in row.turn_points:
                # 一致する点がある場合
                if coord == turn_point:
                    geometrys.append(coords[cut_start:cut_end])
                    # turn_pointsから削除
                    turn_points.remove(turn_point)
                    cut_start = cut_end - 1
                    break
        geometrys.append(coords[cut_start:cut_end])

        ## 1件だけなら何もしない。多分この判定は使われなさそうだけど念の為。
        if len(geometrys) == 1:
            continue

        # 分割したGeometryにあわせてGeoDataFrame更新する
        st_node = index[0]
        ## osmのnode_idとかぶらなさそうなIDを割り振る
        new_node_id = 100000000000
        ed_node = new_node_id
        for i, geometry in enumerate(geometrys):
            new_index = (st_node, ed_node, 0)
            new_row = row.copy()
            new_row.geometry = sp.LineString(geometry)
            new_row.length = get_cartesian_length_from_coordinate(new_row.geometry)
            gdf.loc[new_index] = new_row
            st_node = ed_node
            ## iが最後のindexでない場合は新しいnode_idを割り振る
            if i != len(geometrys) - 1:
                ed_node = new_node_id
                new_node_id += 1
            else:
                ed_node = index[1]
        ## 元の行を削除
        gdf.drop(index, inplace=True)
    return gdf


def get_cartesian_length_from_coordinate(line_string: sp.LineString) -> int:
    transformer = proj.Transformer.from_crs(4326, 6677)
    # LineString内のpyprojが扱える形式に変換(y(経度), x(緯度))する
    trans_coords = transformer.itransform(line_string.coords, switch=True)
    return sp.LineString(trans_coords).length
