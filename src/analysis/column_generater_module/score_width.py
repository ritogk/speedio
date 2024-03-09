from geopandas import GeoDataFrame
from pandas import Series


# 道幅を評価する
# 道幅で信頼でき情報源がalpsmapしかないのでその情報をもとに評価する
def generate(gdf: GeoDataFrame) -> Series:

    # is_alpsmapがtrueかつalpsmap_min_widthが5.5以上のエッジを1にしてそれ以外を0.8にする
    def func(row):
        if row["is_alpsmap"] and row["alpsmap_min_width"] >= 5.5:
            return 1
        else:
            return 0.8

    series = gdf.apply(func, axis=1)
    return series
