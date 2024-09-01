from geopandas import GeoDataFrame
from pandas import Series

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


# 開始、中央、終了地点からgoogleMapのルートURLを作成する
def generate(gdf: GeoDataFrame) -> Series:
    usename = "postgres"
    password = "postgres"
    dbname = "speedia"
    host="localhost"
    port="5432"
    engine = create_engine(f"postgresql://{usename}:{password}@{host}:{port}/{dbname}")
    Session = sessionmaker(bind=engine)
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
        with Session() as session:
            # SQLクエリを実行
            result = session.execute(text(f"SELECT ST_X(point) AS longitude, ST_Y(point) AS latitude, road_width_type  FROM locations WHERE ST_Intersects(ST_MakeEnvelope({min_longitude}, {min_latitude}, {max_longitude}, {max_latitude}, {srid}), locations.point)"))
            result = result.fetchall()
            # print(f"coords: {len(coords)}")
            # print(f"db_result: {len(rows)}")
            # geometryの座標に一致するデータのみ取り出す
            for coord in coords:
                for data in result:
                    if data.longitude == coord[0] and data.latitude == coord[1]:
                        locations.append(data._asdict())
        print(locations)
        return locations

    series = gdf.apply(func, axis=1)
    return series
