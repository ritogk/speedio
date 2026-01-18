from geopandas import GeoDataFrame
from pandas import Series
from tqdm import tqdm
import pandas as pd
from .core.segmnet import generate_segment_original_index_list
from .core.smoother import generate_moving_average

INTERVAL = 1
WINDOW_SIZE = 5

# 指定距離単位の標高一覧を生成する
def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        segment_index_list = generate_segment_original_index_list(x.geometry, INTERVAL, x.length)
        # elevation_dataからsegment_listのindexの値を抽出
        elevation_segment_list = []
        for segment_index in segment_index_list:
            elevation_segment_list.append(x.elevation_smooth[segment_index])
        # 移動平均で平準化
        series = pd.Series(elevation_segment_list)
        smooth_elevations = generate_moving_average(series, WINDOW_SIZE).to_list()
        # 少数第1桁以下を切り捨てる
        smooth_elevations = [round(elevation, 1) for elevation in smooth_elevations]
        return smooth_elevations

    tqdm.pandas()
    series = gdf.progress_apply(func, axis=1)

    return series