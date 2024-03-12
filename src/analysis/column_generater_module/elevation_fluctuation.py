from geopandas import GeoDataFrame
from pandas import Series


# 標高の変化量を取得する
def generate(gdf: GeoDataFrame) -> tuple[Series, Series]:
    def func(row):
        elevations = row.elevation_smooth
        total_elevation_up = 0
        total_elevation_down = 0
        prev_elevation = None
        # ジオメトリーの座標から標高を取得し、標高の変化量も計算する
        for elevation in elevations:
            # 標高変化量の計算
            if prev_elevation is not None:
                elevation_diff = elevation - prev_elevation
                # 標高の変化量が40m以上の場合はtif範囲外を見ている可能性があるため、無視する
                if abs(elevation_diff) >= 40:
                    print(f"The change in elevation is over 40 meters")
                if elevation_diff > 0:
                    total_elevation_up += abs(elevation_diff)
                else:
                    total_elevation_down += abs(elevation_diff)
            prev_elevation = elevation

        return total_elevation_up, total_elevation_down

    total_elevation = gdf.apply(func, axis=1)
    series_up = total_elevation.apply(lambda x: x[0])
    series_down = total_elevation.apply(lambda x: x[1])

    return series_up, series_down
