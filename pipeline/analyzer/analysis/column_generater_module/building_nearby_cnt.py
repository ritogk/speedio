from geopandas import GeoDataFrame
from pandas import Series
from tqdm import tqdm
from shapely import wkt
from ...core.db import get_db_session
from .core.linstring_to_polygon import create_vertical_polygon

from sqlalchemy import text

# 道路の周辺20m以内にある建物の数をカウントする
def generate(gdf: GeoDataFrame) -> Series:
    # DBセッションを1つだけ作成して全エッジで共有（元は1エッジごとにセッション作成・破棄）
    session = get_db_session()

    def func(row):
        bbox = row.geometry.bounds
        polygon = create_vertical_polygon(row.geometry.coords, 15)
        buildings = _get_buildings_in_bbox(session, bbox[0], bbox[1], bbox[2], bbox[3])
        return sum(1 for b in buildings if b.intersects(polygon))

    tqdm.pandas()
    series = gdf.progress_apply(func, axis=1)
    session.close()

    return series

def _get_buildings_in_bbox(session, min_longitude, min_latitude, max_longitude, max_latitude):
    query = text("""
    SELECT ST_AsText(geometry) as geometry
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
    return [wkt.loads(row[0]) for row in result.fetchall()]