from pandas import Series

# 指定のサンプリングサイズで移動平均を求める。
# サンプリングサイズ時の欠損値は補完してシリーズの列数を維持する。
def generate_moving_average(series: Series, window_size:int) -> Series:
    smooth = series.rolling(window=window_size).mean().dropna().tolist()
    if len(series) >= window_size:
        last_avg = [series.iloc[-i:].mean() for i in range(window_size, 1, -1)]
        smooth.extend(last_avg)
    return Series(smooth)