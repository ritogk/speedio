from geopandas import GeoDataFrame
from pandas import Series
from .core import elevetion_service


# 標高の変化量を取得する
def generate(gdf: GeoDataFrame, tif_path: str) -> tuple[Series, Series]:
    elevetion_service_ins = elevetion_service.ElevationService(tif_path)

    def func(row):
        locations = list(row.geometry.coords)
        elevations = []
        elevation_deltas = 0
        prev_elevation = None

        # ジオメトリーの座標から標高を取得し、標高の変化量も計算する
        for location in locations:
            elevation = elevetion_service_ins.get_elevation(location[1], location[0])
            if elevation is None:
                print("elevation is None")
                continue

            elevations.append({"elevation": elevation, "location": location})

            # 標高変化量の計算
            if prev_elevation is not None:
                elevation_abs = abs(elevation - prev_elevation)
                # 標高の変化量が40m以上の場合はtif範囲外を見ている可能性があるため、無視する
                if elevation_abs <= 40:
                    elevation_deltas += elevation_abs
                else:
                    print(
                        f"The change in elevation is over 40 meters. st: {location}, ed: {prev_location}"
                    )
            prev_elevation = elevation
            prev_location = location

        return elevation_deltas, elevations

    results = gdf.apply(func, axis=1)
    series_deltas = results.apply(lambda x: x[0])
    series_elevations = results.apply(lambda x: x[1])

    return series_deltas, series_elevations
