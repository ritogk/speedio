import math
from geopandas import GeoDataFrame
from pandas import Series


def _haversine(a, b):
    R = 6371000
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    aa = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(aa))


def _gradient_penalty(grad):
    low, high = 3.0, 7.0
    if low <= grad <= high:
        return 1.0
    elif grad < low:
        return max(0.0, grad / low)
    else:
        return max(0.0, 1.0 - ((grad - high) / 1.8) ** 2)


def _to_score(raw):
    ref = 250.0
    if raw >= 25:
        return min(1.0, 0.5 + 0.5 * (raw - 25) / (ref - 25))
    else:
        return (raw / 25) ** 1.3 * 0.5


def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        height = row["elevation_height"]
        geo = row["geometry_list"]
        if not geo or len(geo) < 2 or height <= 0:
            return 0.0
        total_dist = sum(_haversine(geo[i], geo[i + 1]) for i in range(len(geo) - 1))
        if total_dist <= 0:
            return 0.0
        grad = height / total_dist * 100
        pen = _gradient_penalty(grad)
        raw = height * pen
        return round(_to_score(raw), 4)

    return gdf.apply(func, axis=1)
