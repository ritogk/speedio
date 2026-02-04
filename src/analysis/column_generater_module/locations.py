from geopandas import GeoDataFrame
from pandas import Series

from sqlalchemy import text
from ...core.db import get_db_session


# 開始、中央、終了地点からgoogleMapのルートURLを作成する
def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        coords = list(row.geometry.coords)
        min_longitude = coords[0][0]
        max_longitude = coords[0][0]
        min_latitude = coords[0][1]
        max_latitude = coords[0][1]

        for point in coords:
            if point[0] < min_longitude:
                min_longitude = point[0]
            if point[0] > max_longitude:
                max_longitude = point[0]
            if point[1] < min_latitude:
                min_latitude = point[1]
            if point[1] > max_latitude:
                max_latitude = point[1]
        srid = 4326
        locations = []
        # SQLクエリを実行
        result = session.execute(text(
            f"SELECT ST_X(point) AS longitude, ST_Y(point) AS latitude, road_width_type, has_center_line, claude_center_line, claude_road_width_type "
            f"FROM locations "
            f"WHERE ST_Intersects(ST_MakeEnvelope({min_longitude}, {min_latitude}, {max_longitude}, {max_latitude}, {srid}), locations.point)"
        ))
        result = result.fetchall()
        # print(f"coords: {len(coords)}")
        # print(f"db_result: {len(rows)}")
        # geometryの座標に一致するデータのみ取り出す
        for coord in coords:
            for data in result:
                if data.longitude == coord[0] and data.latitude == coord[1]:
                    locations.append(data._asdict())

        return locations
    session = get_db_session()
    try:
        series = gdf.apply(func, axis=1)
    finally:
        session.close()
    return series
