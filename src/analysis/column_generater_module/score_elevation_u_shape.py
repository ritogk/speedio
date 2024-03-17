from geopandas import GeoDataFrame
from pandas import Series


# 標高のU字型のスコアを求める。
def generate(gdf: GeoDataFrame) -> Series:
    # `愛知の感動した道`: 388
    # `地元の火葬場:` 97.4
    # `そこそこいい道`: 69.5, 52.49, 16.7, 19.46, 25.02, 61.2, 13.37, 9.006, 2.25, 2.03
    # `悪い道`: 1.24, 7.5
    # 一旦80以上は1で、80~0は0~1に変換する
    def func(x):
        min = 0
        max = 80
        if x > max:
            return 1
        return (x - min) / (max - min)

    series = gdf["elevation_u_shape"].apply(func)
    return series
