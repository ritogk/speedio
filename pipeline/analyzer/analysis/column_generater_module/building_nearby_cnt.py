from geopandas import GeoDataFrame
from pandas import Series
from tqdm import tqdm
from ...core.db import get_db_session

from sqlalchemy import text

# 道路のbbox内にある建物の数をカウントする
def generate(gdf: GeoDataFrame) -> Series:
    session = get_db_session()

    def func(row):
        bbox = row.geometry.bounds
        return _count_buildings_in_bbox(session, bbox[0], bbox[1], bbox[2], bbox[3])

    tqdm.pandas()
    series = gdf.progress_apply(func, axis=1)
    session.close()

    return series

def _count_buildings_in_bbox(session, min_longitude, min_latitude, max_longitude, max_latitude):
    query = text("""
    SELECT COUNT(*)
    FROM buildings
    WHERE ST_Intersects(
    geometry,
    ST_MakeEnvelope(:min_longitude, :min_latitude, :max_longitude, :max_latitude, :srid)
    );
    """)
    result = session.execute(query, {
        'min_longitude': float(min_longitude),
        'min_latitude': float(min_latitude),
        'max_longitude': float(max_longitude),
        'max_latitude': float(max_latitude),
        'srid': 4326
    })
    return result.scalar()