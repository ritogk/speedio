import os
from osgeo import gdal

from jpd2011 import batch_reproject_tiffs as convert_jpd2011
from jpd2000 import batch_reproject_tiffs as convert_jpd2000
from merge import main as merge_tif
folder_list = [
    "FG-GML-chubu-DEM10-Z001",
    "FG-GML-chugoku-DEM10-Z001",
    "FG-GML-hokkaido-DEM10-Z001",
    "FG-GML-hokuriku-DEM10-Z001",
    "FG-GML-kanto123-DEM10-Z001",
    "FG-GML-kinki-DEM10-Z001",
    "FG-GML-kyushu_okinawa-DEM10-Z001",
    "FG-GML-shikoku-DEM10-Z001",
    "FG-GML-tohoku-DEM10-Z001"
]



prefix = '/mnt/e/xxxxxx'
jpd2000_tif_path = prefix + '/jpd2000'
jpd2011_tif_path = prefix + '/jpd2011'
output_path = prefix + '/output'
output_jpd2000_tif_path = output_path + '/jpd2000'
output_jpd2011_tif_path = output_path + '/jpd2011'
output_merge_tif_path = output_path + '/merge.tif'

jpd2000_epsg = 4612
jpd2011_epsg = 6668
dst_epsg = 4326

for folder in folder_list:
    # jpd2000_tif_pathのxxxxxxをfolderに変更
    current_jpd2000_tif_path = jpd2000_tif_path.replace('xxxxxx', folder)
    current_output_jpd2000_tif_path = output_jpd2000_tif_path.replace('xxxxxx', folder)
    if os.path.exists(current_jpd2000_tif_path):
        convert_jpd2011(current_jpd2000_tif_path, current_output_jpd2000_tif_path, jpd2000_epsg, dst_epsg)

    current_jpd2011_tif_path = jpd2011_tif_path.replace('xxxxxx', folder)
    current_output_jpd2011_tif_path = output_jpd2011_tif_path.replace('xxxxxx', folder)
    if os.path.exists(current_jpd2011_tif_path):
        convert_jpd2011(current_jpd2011_tif_path, current_output_jpd2011_tif_path, jpd2011_epsg, dst_epsg)



# merge_tif(output_path, output_merge_tif_path)