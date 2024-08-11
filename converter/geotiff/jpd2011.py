import os
from osgeo import gdal

# jpd2000(epsg:4612)のtiffをepsg:4326に変換する。
def reproject_tiff(input_tiff, output_tiff, src_epsg, dst_epsg):
    # Open the input file
    src_ds = gdal.Open(input_tiff)
    if src_ds is None:
        print(f"Unable to open {input_tiff}")
        return

    # Define the target spatial reference
    dst_wkt = f'EPSG:{dst_epsg}'

    # Perform the reprojection
    gdal.Warp(output_tiff, src_ds, dstSRS=dst_wkt, srcSRS=f'EPSG:{src_epsg}')

    print(f"Reprojected {input_tiff} to {output_tiff} with EPSG:{dst_epsg}")

def batch_reproject_tiffs(input_dir, output_dir, src_epsg, dst_epsg):
    # Ensure the output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Loop through all files in the input directory
    for filename in os.listdir(input_dir):
        if filename.lower().endswith('.tif') or filename.lower().endswith('.tiff'):
            input_tiff = os.path.join(input_dir, filename)
            output_tiff = os.path.join(output_dir, filename)
            reproject_tiff(input_tiff, output_tiff, src_epsg, dst_epsg)

# # Usage
# input_dir = 'input_directory/jpd2011'  # Replace with the path to the directory containing input TIFF files
# output_dir = 'output_directory/jpd2011'  # Replace with the path to the directory to save reprojected TIFF files
# src_epsg = 6668  # Source EPSG code
# dst_epsg = 4326  # Destination EPSG code

# batch_reproject_tiffs(input_dir, output_dir, src_epsg, dst_epsg)