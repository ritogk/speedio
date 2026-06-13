from geopandas import GeoDataFrame
from pandas import Series
import numpy as np
from .core import elevation_service

# 標高の変化量を取得する
def generate(gdf: GeoDataFrame, tif_path: str) -> Series:
    elevation_service_ins = elevation_service.ElevationService(tif_path)

    def func(row) -> list:
        coords = np.array(list(row.geometry.coords))
        # coords[:,1]=lat, coords[:,0]=lon でバッチ取得（1点ずつのget_elevation()を廃止）
        elevations = elevation_service_ins.get_elevations_batch(coords[:, 1], coords[:, 0])
        return elevations.tolist()

    results = gdf.apply(func, axis=1)

    del elevation_service_ins

    return results
