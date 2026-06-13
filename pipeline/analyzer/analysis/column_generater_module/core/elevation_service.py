import numpy as np
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling
from pyproj import CRS


class ElevationService:
    def __init__(self, tif_path):
        self.dataset = rasterio.open(tif_path)
        src_crs = self.dataset.crs
        if src_crs is None or CRS(src_crs).to_epsg() != 4326:
            epsg = CRS(src_crs).to_epsg() if src_crs else "unknown"
            print(f"EPSG: {epsg} → EPSG: 4326")
            dst_crs = "EPSG:4326"
            transform, width, height = calculate_default_transform(
                src_crs, dst_crs, self.dataset.width, self.dataset.height, *self.dataset.bounds
            )
            profile = self.dataset.profile.copy()
            profile.update(crs=dst_crs, transform=transform, width=width, height=height)
            data = np.empty((1, height, width), dtype=self.dataset.dtypes[0])
            reproject(
                source=rasterio.band(self.dataset, 1),
                destination=data[0],
                src_transform=self.dataset.transform,
                src_crs=src_crs,
                dst_transform=transform,
                dst_crs=dst_crs,
                resampling=Resampling.nearest,
            )
            self.dataset.close()
            with rasterio.open(tif_path, "w", **profile) as dst:
                dst.write(data)
            self.dataset = rasterio.open(tif_path)

    def get_elevation(self, lat: int, lon: int) -> int | None:
        if self.dataset is None or self.dataset.closed:
            return None
        row, col = self.dataset.index(lon, lat)
        if row < 0 or col < 0 or row >= self.dataset.height or col >= self.dataset.width:
            return None
        band = self.dataset.read(1, window=rasterio.windows.Window(col, row, 1, 1))
        return band[0, 0]

    def get_elevations_batch(self, lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
        """複数座標の標高を一括取得（1点ずつのread()を廃止しwindow一括読みに）"""
        if self.dataset is None or self.dataset.closed:
            return np.zeros(lats.shape)
        lats = np.asarray(lats)
        lons = np.asarray(lons)
        t = self.dataset.transform
        # アフィン逆変換でピクセル座標を算出（dataset.index()と同等）
        cols = np.floor((lons - t.c) / t.a).astype(int)
        rows = np.floor((lats - t.f) / t.e).astype(int)
        row_min = max(0, int(rows.min()))
        row_max = min(self.dataset.height - 1, int(rows.max()))
        col_min = max(0, int(cols.min()))
        col_max = min(self.dataset.width - 1, int(cols.max()))
        window = rasterio.windows.Window(col_min, row_min, col_max - col_min + 1, row_max - row_min + 1)
        data = self.dataset.read(1, window=window)
        local_rows = np.clip(rows - row_min, 0, data.shape[0] - 1).astype(int)
        local_cols = np.clip(cols - col_min, 0, data.shape[1] - 1).astype(int)
        return data[local_rows, local_cols]

    def __del__(self):
        if self.dataset and not self.dataset.closed:
            self.dataset.close()
        self.dataset = None
