from geopandas import GeoDataFrame
from pandas import Series


# 道幅を評価する
# 道幅で信頼できる情報源がlanesとalpsmapしかないのでその情報をもとに評価する
def generate(gdf: GeoDataFrame) -> Series:

    def func(row):
        score = 0.5
        if row["lanes"] == "2":
            score += 0.25
        if row["is_alpsmap"] and row["alpsmap_min_width"] >= 5.5:
            score += 0.25
        return score

    series = gdf.apply(func, axis=1)
    return series
