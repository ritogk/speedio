from geopandas import GeoDataFrame
from pandas import Series


# 高低差が大きいエッジを評価する
def generate(gdf: GeoDataFrame) -> Series:
    # 距離と標高の比率が0.07mを超える場合に高低差が大きすぎるとする
    # 観測した範囲ないだと0.83mくらいが最大だったので0.9mを最大値として、それ以上は1とする
    def func(x):
        min = 0.07
        max = 0.09
        if x < min:
            return 0
        elif x <= max:
            return (x - min) / (max - min)
        else:
            return 1

    # カスタム関数を適用
    series = gdf["elevation_height_and_length_ratio"].apply(func)
    # マイナス値は0とする
    series = series.apply(lambda x: 0 if x < 0 else x)
    return series
