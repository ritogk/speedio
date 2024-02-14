from geopandas import GeoDataFrame
from pandas import Series
from .core import elevetion_service


# 標高の変化量を取得する
def generate(gdf: GeoDataFrame, tif_path: str) -> Series:
    elevetion_service_ins = elevetion_service.ElevationService(tif_path)

    def func(row):
        locations = list(row.geometry.coords)
        # locationsの緯度と経度の要素番号を逆にする
        locations = [list(reversed(location)) for location in locations]
        elevations = []
        # ジオメトリーの座標から標高を取得する
        for location in locations:
            elevation = elevetion_service_ins.get_elevation(location[0], location[1])
            if elevation is None:
                print("elevation is None")
                continue
            elevations.append({"elevation": elevation})

        elevetion_change_amount = 0
        for i in range(1, len(elevations)):
            # print(elevations[i - 1]["elevation"])
            elevetion_change_amount += abs(
                elevations[i]["elevation"] - elevations[i - 1]["elevation"]
            )
        return elevetion_change_amount

    series = gdf.apply(func, axis=1)

    return series
