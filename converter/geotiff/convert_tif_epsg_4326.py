import os
from osgeo import gdal

# 全国のtif(jgd2000,jgd2011)をepsg:4326に変換する
prefix = './work'
input_path = prefix + '/input/xxxxxx'
jpd2000_tif_path = input_path + '/jpd2000'
jpd2011_tif_path = input_path + '/jpd2011'
output_path = prefix + '/output'
output_jpd2000_tif_path = output_path + '/jpd2000'
output_jpd2011_tif_path = output_path + '/jpd2011'
output_merge_tif_path = output_path + '/merge_tif'
def main():
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

    jpd2000_epsg = 4612
    jpd2011_epsg = 6668
    dst_epsg = 4326

    for folder in folder_list:
        # jpd2000_tif_pathのxxxxxxをfolderに変更
        current_jpd2000_tif_path = jpd2000_tif_path.replace('xxxxxx', folder)
        print(current_jpd2000_tif_path)
        current_output_jpd2000_tif_path = output_jpd2000_tif_path.replace('xxxxxx', folder)
        if os.path.exists(current_jpd2000_tif_path):
            batch_reproject_tiffs(current_jpd2000_tif_path, current_output_jpd2000_tif_path, jpd2000_epsg, dst_epsg)

        current_jpd2011_tif_path = jpd2011_tif_path.replace('xxxxxx', folder)
        current_output_jpd2011_tif_path = output_jpd2011_tif_path.replace('xxxxxx', folder)
        if os.path.exists(current_jpd2011_tif_path):
            batch_reproject_tiffs(current_jpd2011_tif_path, current_output_jpd2011_tif_path, jpd2011_epsg, dst_epsg)

def reproject_tiff(input_tiff, output_tiff, src_epsg, dst_epsg):
    # Open the input file
    src_ds = gdal.Open(input_tiff)
    if src_ds is None:
        print(f"Unable to open {input_tiff}")
        return

    dst_wkt = f'EPSG:{dst_epsg}'
    gdal.Warp(output_tiff, src_ds, dstSRS=dst_wkt, srcSRS=f'EPSG:{src_epsg}')
    print(f"Reprojected {input_tiff} to {output_tiff} with EPSG:{dst_epsg}")

def batch_reproject_tiffs(input_dir, output_dir, src_epsg, dst_epsg):
    os.makedirs(output_dir, exist_ok=True)

    # Loop through all files in the input directory
    for filename in os.listdir(input_dir):
        if filename.lower().endswith('.tif') or filename.lower().endswith('.tiff'):
            input_tiff = os.path.join(input_dir, filename)
            output_tiff = os.path.join(output_dir, filename)
            reproject_tiff(input_tiff, output_tiff, src_epsg, dst_epsg)
# このファイルが直接実行されたときにのみ main を呼び出す
if __name__ == "__main__":
    main()