from geopandas import GeoDataFrame
from pandas import Series


# エッジの幅を求める
def generate(gdf: GeoDataFrame) -> tuple[Series, Series]:
    # アルプスマップのデータを含む行に1を立てる
    # エッジが結合していると「YahooJapan/ALPSMAP;GSI ortorectified」のようなデータが含まれるが「YahooJapan/ALPSMAP」以外の道幅はタグから取得できないので、除外する
    avg_series, min_series = generate_from_alpsmap(gdf[gdf["is_alpsmap"] == 1])

    return avg_series, min_series


# アルプスマップのタグから道幅を求める
def generate_from_alpsmap(gdf: GeoDataFrame) -> tuple[Series, Series] | None:
    # 条件に基づいてシリーズを整形
    def format_min(x):
        if isinstance(x, str):
            return float(x.split("〜")[0].replace("m", ""))
        elif isinstance(x, list):
            return min(float(item.split("〜")[0].replace("m", "")) for item in x)

    def format_avg(x):
        if isinstance(x, str):
            min = float(x.split("〜")[0].replace("m", ""))
            max = float(x.split("〜")[1].replace("m", ""))
            return (min + max) / 2
        elif isinstance(x, list):
            cnt = 0
            for item in x:
                min = float(item.split("〜")[0].replace("m", ""))
                max = float(item.split("〜")[1].replace("m", ""))
                cnt += min + max
            return cnt / (len(x) * 2)

    min_series = gdf["yh:WIDTH"].apply(lambda x: format_min(x))
    avg_series = gdf["yh:WIDTH"].apply(lambda x: format_avg(x))

    return avg_series, min_series
