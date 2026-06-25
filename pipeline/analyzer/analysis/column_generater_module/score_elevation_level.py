from geopandas import GeoDataFrame
from pandas import Series

def generate(gdf: GeoDataFrame) -> tuple[Series, Series, Series, Series]:
    def func(row):
        sections = row.elevation_section
        if not sections:
            return 0, 0, 0, 0
        total = len(sections)
        flat = sum(1 for s in sections if s['level'] == 'flat') / total
        gentle = sum(1 for s in sections if s['level'] == 'gentle') / total
        moderate = sum(1 for s in sections if s['level'] == 'moderate') / total
        steep = sum(1 for s in sections if s['level'] == 'steep') / total
        return flat, gentle, moderate, steep
    results = gdf.apply(func, axis=1, result_type='expand')
    return results[0], results[1], results[2], results[3]
