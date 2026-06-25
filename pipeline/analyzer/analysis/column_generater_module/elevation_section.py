from geopandas import GeoDataFrame
from pandas import Series
import math

INTERVAL = 500
FLAT_MAX = 1.0
GENTLE_MAX = 3.0
STEEP_MIN = 7.0

def _cumulative_distances(geometry_list):
    dists = [0.0]
    for i in range(1, len(geometry_list)):
        p0, p1 = geometry_list[i - 1], geometry_list[i]
        dlat = (p1[0] - p0[0]) * 111320
        dlng = (p1[1] - p0[1]) * 111320 * math.cos(p0[0] * math.pi / 180)
        dists.append(dists[-1] + math.sqrt(dlat * dlat + dlng * dlng))
    return dists

def _interpolate_elevation(cum_dists, elev_smooth, target_dist):
    for i in range(1, len(cum_dists)):
        if cum_dists[i] >= target_dist:
            d0, d1 = cum_dists[i - 1], cum_dists[i]
            if d1 == d0:
                return elev_smooth[i]
            ratio = (target_dist - d0) / (d1 - d0)
            return elev_smooth[i - 1] + (elev_smooth[i] - elev_smooth[i - 1]) * ratio
    return elev_smooth[-1]

def generate(gdf: GeoDataFrame) -> Series:
    def func(row):
        geo = row.geometry_list
        elev = row.elevation_smooth
        if len(geo) < 2 or len(elev) < 2:
            return []

        cum_dists = _cumulative_distances(geo)
        total_dist = cum_dists[-1]
        n_segs = max(1, int(total_dist // INTERVAL))

        sections = []
        for i in range(n_segs):
            d0 = i * INTERVAL
            d1 = min((i + 1) * INTERVAL, total_dist)
            e0 = _interpolate_elevation(cum_dists, elev, d0)
            e1 = _interpolate_elevation(cum_dists, elev, d1)
            seg_len = d1 - d0
            grad = abs(e1 - e0) / seg_len * 100 if seg_len > 0 else 0

            if grad < FLAT_MAX:
                level = 'flat'
            elif grad < GENTLE_MAX:
                level = 'gentle'
            elif grad < STEEP_MIN:
                level = 'moderate'
            else:
                level = 'steep'
            sections.append({'level': level})
        return sections
    return gdf.apply(func, axis=1)
