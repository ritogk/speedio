from geopandas import GeoDataFrame
from pandas import Series
from tqdm import tqdm
import pandas as pd
from .core.segmnet import generate_segment_original_index_list

INTERVAL = 50
WINDOW_SIZE = 5

def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        segment_index_list = generate_segment_original_index_list(x.geometry, INTERVAL, x.length)
        # elevation_dataからsegment_listのindexの値を抽出
        coords_segment_list = []
        for segment_index in segment_index_list:
            coords_segment_list.append(x.geometry_list[segment_index])
        return coords_segment_list

    tqdm.pandas()
    series = gdf.progress_apply(func, axis=1)

    return series