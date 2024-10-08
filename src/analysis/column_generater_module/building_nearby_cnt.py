from geopandas import GeoDataFrame
from pandas import Series
from tqdm import tqdm
from shapely import wkt
from ...core.db import get_db_session
from .core.linstring_to_polygon import create_vertical_polygon

from sqlalchemy import text

# 道路の周辺20m以内にある建物の数をカウントする
def generate(gdf: GeoDataFrame) -> Series:

    def func(row):
        bbox = row.geometry.bounds
        # LinStringから上下に20m垂直に伸ばしたポリゴンを作成する。
        polygon = create_vertical_polygon(row.geometry.coords, 20)

        buildings = get_nearby_builgings(bbox[0], bbox[1], bbox[2], bbox[3])

        # sqlでデータを取得してpolygon or multipolylineを取得すればよいはず。

        match_buildings = []
        for index, building in enumerate(buildings):
            # 建物が Polygon に重なっているか確認
            if building.intersects(polygon):
                # print(building)
                match_buildings.append(index)
        # 重複を排除
        unique_buildings = list(dict.fromkeys(match_buildings))

        result = len(unique_buildings)
        return result

    tqdm.pandas()
    series = gdf.progress_apply(func, axis=1)

    return series

# 近くの建物を取得する
def get_nearby_builgings(min_longitude, min_latitude, max_longitude, max_latitude):
    session = get_db_session()
    try:
        buildings = []

        # SQLクエリを実行
        query = text(f"""
        SELECT ST_AsText(geometry) as geometry
        FROM buildings
        WHERE ST_Intersects(
        geometry, 
        ST_MakeEnvelope(:min_longitude, :min_latitude, :max_longitude, :max_latitude, :srid)
        );
        """)
        
        # パラメータを渡してクエリ実行
        result = session.execute(query, {
            'min_longitude': min_longitude,
            'min_latitude': min_latitude,
            'max_longitude': max_longitude,
            'max_latitude': max_latitude,
            'srid': 4326
        })
        result = result.fetchall()
        for data in result:
            geometry = wkt.loads(data[0])
            buildings.append(geometry)
    finally:
        session.close()
    return buildings