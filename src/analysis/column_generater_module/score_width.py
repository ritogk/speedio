from geopandas import GeoDataFrame
from pandas import Series

from sqlalchemy import create_engine, text, func
from sqlalchemy.orm import sessionmaker

# 目視検証データから道幅を評価する
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
            result = session.execute(text(f"SELECT ST_X(point) AS longitude, ST_Y(point) AS latitude, \"roadCondition\"  FROM locations WHERE ST_Intersects(ST_MakeEnvelope({min_longitude}, {min_latitude}, {max_longitude}, {max_latitude}, {srid}), locations.point)"))
            result = result.fetchall()
            # print(f"coords: {len(coords)}")
            # print(f"db_result: {len(rows)}")
            # geometryの座標に一致するデータのみ取り出す
            for coord in coords:
                for data in result:
                    if data.longitude == coord[0] and data.latitude == coord[1]:
                        locations.append(data)
        score = 0
        # 必要最低限の座標データがある場合のみに評価する
        # 上記の判断式: points / (length/500) ≥ 0.5の場合
        if (len(locations) / (row.length / 500)) >= 0.5:
            # ここに入ってこれるって事は十分なデータがあるって事
            for location in locations:
                if location.roadCondition == "TWO_LANE" or location.roadCondition == "TWO_LANE_SHOULDER":
                    score += 1
                elif location.roadCondition == "ONE_LANE_SPACIOUS":
                    score += 0.5
                elif location.roadCondition == "ONE_LANE":
                    score += 0.01
            # print(f"count: {len(locations)} score: {score/len(locations)}")
            return score/len(locations)
        else:
            if row["lanes"] == "2":
                score += 0.1
            if row["is_alpsmap"] and row["alpsmap_min_width"] >= 5.5:
                score += 0.1
            return score

    series = gdf.apply(func, axis=1)
    return series