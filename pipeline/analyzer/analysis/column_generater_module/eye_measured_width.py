from geopandas import GeoDataFrame
from pandas import Series
import pandas as pd
import numpy as np
from enum import Enum
from ast import literal_eval


class RoadCondition(Enum):
    COMFORTABLE = 1  # 快適に走れる道
    PASSABLE = 2  # 狭い所もある程度は走れる道
    UNPLEASANT = 3  # 狭くて走りたくない道
    UNCONFIRMED = 4  # 未確認


# エッジの幅を求める
def generate(gdf: GeoDataFrame, csv_path: str) -> Series:
    # csvの読み込み
    df = pd.read_csv(csv_path)
    df["geometry_list"] = df["geometry_list"].apply(literal_eval)

    # 一致するgeometryのcheck値を返す。
    def func(x) -> int:
        return RoadCondition.UNCONFIRMED.value
        # 検証用の一時的なコメントアウト
        # match = df["geometry_list"].apply(lambda y: y == x["geometry_list"])
        # filtered_df = df[match]
        # if not filtered_df.empty:
        #     return RoadCondition(int(filtered_df["check"].to_list()[0])).value
        # return RoadCondition.UNCONFIRMED.value

    return gdf.apply(func, axis=1)
