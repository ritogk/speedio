from geopandas import GeoDataFrame
from pandas import Series


def generate(gdf: GeoDataFrame, infra_edge_gdf: GeoDataFrame) -> Series:
    infra_sindex = infra_edge_gdf["geometry"].sindex

    def func(row):
        base_edge_coords = list(row.geometry.coords)
        candidates = list(infra_sindex.intersection(row.geometry.bounds))
        if not candidates:
            return []
        infra_in_bbox = infra_edge_gdf.iloc[candidates]
        sections = []
        for _, infra_edge in infra_in_bbox.iterrows():
            num_match = sum(1 for coord in infra_edge.geometry.coords if coord in base_edge_coords)
            if num_match >= 2:
                coords = list(infra_edge.geometry.coords)
                sections.append([[c[1], c[0]] for c in coords])
        return sections

    return gdf.apply(func, axis=1)
