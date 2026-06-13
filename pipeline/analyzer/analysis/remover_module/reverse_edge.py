from geopandas import GeoDataFrame


# 逆方向のエッジを削除する
def remove(gdf: GeoDataFrame) -> GeoDataFrame:
    drop_target = []
    for index, row in gdf.iterrows():
        # drop_indexにindex[1], index[0]が存在する場合はなにもしない
        if (index[1], index[0], 0) in drop_target:
            continue
        if (index[0], index[1], 0) in drop_target:
            continue
        drop_target.append(index)
    result = gdf[gdf.index.isin(drop_target)]
    return result
