from geopandas import GeoDataFrame
from pandas import Series

# 一旦1建物の横幅の長さを20mとする。
BUILDING_LENGTH = 20

# 近くに建物が少ないほどスコアが高くなる
def generate(gdf: GeoDataFrame) -> tuple[Series, Series, Series]:
    def func(x):
        score = (x.building_nearby_cnt * BUILDING_LENGTH) / x.length
        score=  1 if score > 1 else score
        return 1 - score

    result = gdf.apply(func, axis=1)

    return result
