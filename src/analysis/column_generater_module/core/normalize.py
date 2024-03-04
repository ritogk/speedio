import pandas as pd


def min_max(series: pd.Series) -> pd.Series:
    pd.Series
    min = series.min()
    max = series.max()
    return (series - min) / (max - min)
