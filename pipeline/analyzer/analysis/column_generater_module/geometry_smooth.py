from geopandas import GeoDataFrame
from pandas import Series
import numpy as np
from scipy.interpolate import interp1d
import matplotlib.pyplot as plt
from scipy.interpolate import splprep, splev
from shapely.geometry import LineString

def generate(gdf: GeoDataFrame) -> Series:
    """
    LineString型のgeometryを滑らかにする
    スプライン補間を使用して線形補間を行い、より滑らかなジオメトリを生成する
    """
    def smooth_geometry(geometry):
        # LineString型からポイントの配列を取得
        if not isinstance(geometry, LineString):
            if isinstance(geometry, list) and len(geometry) >= 2:
                geometry = LineString(geometry)
            else:
                return LineString([])
                
        coords = np.array(geometry.coords)
        if len(coords) < 3:
            # 三次スプラインは最低3点必要
            return geometry

        x, y = coords[:, 0], coords[:, 1]

        try:
            # 三次スプライン (必ず全ての点を通過) s=0
            tck, u = splprep([x, y], s=0, k=3)

            # 補間後の座標を生成 (元の点数の2倍程度)
            unew = np.linspace(0, 1, max(len(coords) * 2, 50))
            out = splev(unew, tck)

            # 新しいLineStringを作成
            smoothed_coords = list(zip(out[0], out[1]))
            return LineString(smoothed_coords)

        except Exception as e:
            print(f"Spline interpolation failed: {e}")
            # 元のジオメトリをLineStringとして返す
            return geometry
    
    series = gdf["geometry"].apply(smooth_geometry)
    return series
