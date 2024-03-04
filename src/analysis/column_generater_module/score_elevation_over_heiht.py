from geopandas import GeoDataFrame
from pandas import Series


# 高低差が大きいエッジを評価する
def generate(gdf: GeoDataFrame) -> Series:
    # 距離と標高の比率が0.08mを超える場合に高低差が大きいとする
    # 観測した範囲ないだと0.13mくらいが最大だったので0.13mを最大値として、それ以上は1とする
    def func(x):
        min = 0.08
        max = 0.13
        if x < min:
            return 0
        elif x <= max:
            return (x - min) / (max - min)
        else:
            return 1

    # カスタム関数を適用
    series = gdf["elavation_height_and_length_ratio"].apply(func)
    return series
