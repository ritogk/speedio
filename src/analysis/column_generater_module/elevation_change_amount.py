from geopandas import GeoDataFrame
from pandas import Series
from .core import elevetion_service


# 標高の変化量を取得する
def generate(gdf: GeoDataFrame, tif_path: str) -> Series:
    elevetion_service_ins = elevetion_service.ElevationService(tif_path)

    def func(row):
        locations = list(row.geometry.coords)
        elevations = []
        # ジオメトリーの座標から標高を取得する
        for location in locations:
            elevation = elevetion_service_ins.get_elevation(location[1], location[0])
            if elevation is None:
                print("elevation is None")
                continue
            elevations.append({"elevation": elevation, "location": location})

        elevetion_change_amount = 0
        for i in range(1, len(elevations)):
            elevation_abs = abs(
                elevations[i]["elevation"] - elevations[i - 1]["elevation"]
            )
            # 標高の変化量が40m以上の場合はtif範囲外を見ている可能性があるため、無視する
            if elevation_abs > 40:
                print(
                    f'The change in elevation is over 40 meters. st: {elevations[i]["location"]}, ed: {elevations[i-1]["location"]}'
                )
                continue
            elevetion_change_amount += elevation_abs
        return elevetion_change_amount

    series = gdf.apply(func, axis=1)

    return series
