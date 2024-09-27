from geopandas import GeoDataFrame
import numpy as np


# 以下の条件に該当するエッジを峠の候補にする
# エッジの長さが2000m以上
# ❌️エッジの長さが10000m以下
# ジオメトリーの座標感の角度変化量の合計が120度以上
# 1500mで10分岐以下
def remove(gdf: GeoDataFrame) -> GeoDataFrame:
    lower_bound_meter = 2000
    # max_bound_meter = 10000
    branch_meter_rate = 10 / 1500  # 1500mで10分岐以上ある場合は対象外にする

    gdf["is_target"] = np.where(
        (gdf["length"] >= lower_bound_meter)
        # & (gdf["length"] < max_bound_meter)
        & (gdf["angle_deltas"] > 120)
        & (gdf["connection_node_cnt"] / gdf["length"] <= branch_meter_rate),
        1,
        0,
    )
    return gdf[gdf["is_target"] == 1]
