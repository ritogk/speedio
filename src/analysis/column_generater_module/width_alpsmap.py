from geopandas import GeoDataFrame
from pandas import Series
import numpy as np


# エッジの幅を求める
def generate(gdf: GeoDataFrame) -> tuple[Series, Series]:
    if "yh:WIDTH" not in gdf.columns:
        return Series(), Series()
    # アルプスマップのデータを含む行に1を立てる
    # エッジが結合していると「YahooJapan/ALPSMAP;GSI ortorectified」のようなデータが含まれるが「YahooJapan/ALPSMAP」以外の道幅はタグから取得できないので、除外する
    avg_series, min_series = generate_from_alpsmap(gdf[gdf["is_alpsmap"] == 1])

    return avg_series, min_series


# アルプスマップのタグから道幅を求める
# sample: ['1.5m〜3.0m', '5.5m〜13.0m', '1.5m未満', '3.0m〜5.5m', '13.0以上']
def generate_from_alpsmap(gdf: GeoDataFrame) -> tuple[Series, Series] | None:
    # 条件に基づいてシリーズを整形
    def format_min(x):
        if isinstance(x, str):
            if x == "1.5m未満":
                return 1.5
            if x == "13.0以上" or x == "13.0m以上":
                return 13.0
            return float(x.split("〜")[0].replace("m", ""))
        elif isinstance(x, list):
            widths = []
            print(x)
            for item in x:
                values = item.split("〜")
                if values[0] == "1.5m未満":
                    widths.append(1.5)
                elif values[0] == "13.0以上" or values[0] == "13.0m以上":
                    widths.append(13.0)
                else:
                    widths.append(float(values[0].replace("m", "")))
            return min(widths)

    def format_avg(x):
        if isinstance(x, str):
            if x == "1.5m未満":
                return 1.5
            if x == "13.0以上" or x == "13.0m以上":
                return 13.0
            min = float(x.split("〜")[0].replace("m", ""))
            max = float(x.split("〜")[1].replace("m", ""))
            return (min + max) / 2
        elif isinstance(x, list):
            widths = []
            for item in x:
                values = item.split("〜")
                if values[0] == "1.5m未満":
                    widths.append(1.5)
                    widths.append(1.5)
                elif values[0] == "13.0以上" or "13.0m以上":
                    widths.append(13.0)
                    widths.append(13.0)
                else:
                    widths.append(float(values[0].replace("m", "")))
                    widths.append(float(values[1].replace("m", "")))
            return sum(widths) / len(widths)
            # cnt = 0
            # for item in x:
            #     min = float(item.split("〜")[0].replace("m", ""))
            #     max = float(item.split("〜")[1].replace("m", ""))
            #     cnt += min + max
            # return cnt / (len(x) * 2)

    min_series = gdf["yh:WIDTH"].apply(lambda x: format_min(x))
    avg_series = gdf["yh:WIDTH"].apply(lambda x: format_avg(x))

    return avg_series, min_series
