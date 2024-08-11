from geopandas import GeoDataFrame
from pandas import Series


# 標高の変化量を取得する
def generate(gdf: GeoDataFrame) -> tuple[Series, Series]:
    def func(row):
        elevations = row.elevation_smooth
        elevation_deltas = 0
        prev_elevation = None
        # ジオメトリーの座標から標高を取得し、標高の変化量も計算する
        for elevation in elevations:
            # 標高変化量の計算
            if prev_elevation is not None:
                elevation_abs = abs(elevation - prev_elevation)
                # 標高の変化量が40m以上の場合はtif範囲外を見ている可能性があるため、無視する
                if elevation_abs <= 40:
                    elevation_deltas += elevation_abs
                else:
                    print(f"The change in elevation is over 40 meters")
                    # print(
                    #     f"The change in elevation is over 40 meters. st: {location}, ed: {prev_location}"
                    # )
            prev_elevation = elevation

        return elevation_deltas

    series_deltas = gdf.apply(func, axis=1)

    return series_deltas
