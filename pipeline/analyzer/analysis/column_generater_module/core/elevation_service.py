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

    def __del__(self):
        if self.dataset and not self.dataset.closed:
            self.dataset.close()
        self.dataset = None
