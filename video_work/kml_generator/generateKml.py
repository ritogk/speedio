import csv
import json
import math
from pathlib import Path


# ========================
# 設定（必要に応じてここだけ編集）
# ========================

# 入力となる区間ポイント群 JSON（coords_segment_list.json）
INPUT_SEGMENT_JSON_PATH = Path("../video-overlay-renderer/data/coords_segment_list.json")

# 入力となる GPS CSV ファイル
INPUT_CSV_PATH = Path("../video-overlay-renderer/data/gps_363_2026-01-11.csv")

BASE_KML_PATH = Path("./base_.kml")

# 出力KMLファイル名
OUTPUT_KML_PATH = Path("./output_route.kml")

import re


def load_coords_segment_list(json_path):
	with open(json_path, encoding="utf-8") as f:
		data = json.load(f)
	return data  # [lat, lon]のリスト

def load_gps_start_end(csv_path):
	with open(csv_path, encoding="utf-8") as f:
		reader = csv.DictReader(f)
		rows = list(reader)
	# 先頭・末尾のlat,lon
	st = (float(rows[0]['latitude']), float(rows[0]['longitude']))
	ed = (float(rows[-1]['latitude']), float(rows[-1]['longitude']))
	return st, ed

def haversine(lat1, lon1, lat2, lon2):
	R = 6371000
	phi1 = math.radians(lat1)
	phi2 = math.radians(lat2)
	dphi = math.radians(lat2 - lat1)
	dlambda = math.radians(lon2 - lon1)
	a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
	return 2*R*math.asin(math.sqrt(a))

def decide_coords_order(coords, st, ed):
	# coords: [ [lat,lon], ... ]
	first = coords[0]
	last = coords[-1]
	d1 = haversine(st[0], st[1], first[0], first[1]) + haversine(ed[0], ed[1], last[0], last[1])
	d2 = haversine(st[0], st[1], last[0], last[1]) + haversine(ed[0], ed[1], first[0], first[1])
	if d1 <= d2:
		return coords  # そのまま
	else:
		return list(reversed(coords))

def coords_to_kml_coords(coords):
	return [f"{lon},{lat},0" for lat, lon in coords]


def calc_center_and_length(coords):
	# coords: ["lon,lat,0", ...] 形式
	lats = []
	lons = []
	for c in coords:
		lon, lat, *_ = map(float, c.split(','))
		lats.append(lat)
		lons.append(lon)
	center_lat = sum(lats) / len(lats)
	center_lon = sum(lons) / len(lons)
	# 全長計算（区間の合計距離）
	length = 0
	for i in range(1, len(coords)):
		length += haversine(lats[i-1], lons[i-1], lats[i], lons[i])
	return center_lon, center_lat, length

def replace_route_coordinates_in_kml(base_kml_path, output_kml_path, new_coords):
	with open(base_kml_path, encoding="utf-8") as f:
		kml = f.read()
	# Routeの<coordinates>...</coordinates>部分を置換
	kml = re.sub(
		r'(<name>Route</name>[\s\S]*?<coordinates>)([\s\S]*?)(</coordinates>)',
		lambda m: m.group(1) + "\n  " + "\n  ".join(new_coords) + "\n" + m.group(3),
		kml,
		count=1
	)
	# Start/End marker
	if new_coords:
		start_coord = new_coords[0]
		end_coord = new_coords[-1]
		kml = re.sub(
			r'(<name>Start</name>[\s\S]*?<coordinates>)([\s\S]*?)(</coordinates>)',
			lambda m: m.group(1) + start_coord + m.group(3),
			kml,
			count=1
		)
		kml = re.sub(
			r'(<name>End</name>[\s\S]*?<coordinates>)([\s\S]*?)(</coordinates>)',
			lambda m: m.group(1) + end_coord + m.group(3),
			kml,
			count=1
		)
		# Zoom to route (range=32000のgx:FlyToのみ)
		center_lon, center_lat, route_length = calc_center_and_length(new_coords)
		# rangeはroute_lengthの2.5倍（目安）
		range_val = max(32000, route_length * 2.5)
		def replace_zoom_to_route(m):
			block = m.group(0)
			if '<range>32000</range>' in block:
				block = re.sub(
					r'(<longitude>)([\d.eE+-]+)(</longitude>[\s\S]*?<latitude>)([\d.eE+-]+)(</latitude>)',
					lambda mm: mm.group(1) + str(center_lon) + mm.group(3) + str(center_lat) + mm.group(5),
					block,
					count=1
				)
				block = re.sub(
					r'(<range>)([\d.eE+-]+)(</range>)',
					lambda mm: mm.group(1) + str(range_val) + mm.group(3),
					block,
					count=1
				)
			return block
		kml = re.sub(
			r'<gx:FlyTo>[\s\S]*?<LookAt>[\s\S]*?</gx:FlyTo>',
			replace_zoom_to_route,
			kml,
			count=0
		)
	with open(output_kml_path, "w", encoding="utf-8") as f:
		f.write(kml)
	print(f"書き換えたKMLを出力しました: {output_kml_path}")

if __name__ == "__main__":
	coords = load_coords_segment_list(INPUT_SEGMENT_JSON_PATH)
	st, ed = load_gps_start_end(INPUT_CSV_PATH)
	coords_ordered = decide_coords_order(coords, st, ed)
	kml_coords = coords_to_kml_coords(coords_ordered)
	replace_route_coordinates_in_kml(BASE_KML_PATH, OUTPUT_KML_PATH, kml_coords)