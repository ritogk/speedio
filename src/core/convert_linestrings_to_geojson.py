from typing import List
from shapely.geometry import LineString


def convert(
    linestring_list: List[List[LineString]],
) -> None:
    # GeoJSONに変換
    def line_to_geojson(line):
        return {"type": "LineString", "coordinates": list(line.coords)}

    features = []
    for item in linestring_list:
        for line in item:
            features.append(
                {
                    "type": "Feature",
                    "geometry": line_to_geojson(line),
                    "properties": {"type": "line"},
                }
            )
    # 全てのFeatureをFeatureCollectionにまとめる
    geojson_data = {"type": "FeatureCollection", "features": features}
    return geojson_data
