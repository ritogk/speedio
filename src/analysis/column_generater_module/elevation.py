from geopandas import GeoDataFrame
from pandas import Series
from .core import elevetion_service
import pandas as pd


# 標高の変化量を取得する
def generate(gdf: GeoDataFrame, tif_path: str) -> Series:
    elevetion_service_ins = elevetion_service.ElevationService(tif_path)

    def func(row) -> list:
        locations = list(row.geometry.coords)
        elevations = []

        # ジオメトリーの座標から標高を取得し、標高の変化量も計算する
        for location in locations:
            elevation = elevetion_service_ins.get_elevation(location[1], location[0])
            if elevation is None:
                print("elevation is None")
                continue
            # elevations.append({"elevation": elevation, "location": location})
            elevations.append(elevation)
        return elevations

    results = gdf.apply(func, axis=1)
    return results
