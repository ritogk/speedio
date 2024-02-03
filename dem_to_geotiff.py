from osgeo import gdal

# 入力と出力ファイル名
input_dem = '1.xml'
output_geotiff = 'output_geotiff_file.tif'

# DEMを開いて読み込む
dataset = gdal.Open(input_dem)

# GeoTIFFとして保存
gdal.Translate(output_geotiff, dataset, format='GTiff')

# データセットを閉じる
dataset = None
