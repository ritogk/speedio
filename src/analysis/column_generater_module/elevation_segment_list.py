from geopandas import GeoDataFrame
from pandas import Series
from tqdm import tqdm
from .core.segmnet import generate_segment_original_index_list

INTERVAL = 50

# 指定距離単位の標高一覧を生成する
def generate(gdf: GeoDataFrame) -> Series:
    def func(x):
        segment_index_list = generate_segment_original_index_list(x.geometry, INTERVAL, x.length)
        # elevation_dataからsegment_listのindexの値を抽出
        elevation_segment_list = []
        for segment_index in segment_index_list:
            elevation_segment_list.append(x.elevation_smooth[segment_index])

        return elevation_segment_list

    tqdm.pandas()
    series = gdf.progress_apply(func, axis=1)

    return series