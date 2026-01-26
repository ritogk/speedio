import json
import math
from pathlib import Path
from typing import Tuple


# ========================
# 設定（必要に応じてここだけ編集）
# ========================

# 座標ポイント JSON（coords_segment_list.json）
INPUT_COORDS_JSON_PATH = Path("../video-overlay-renderer/data/coords_segment_list.json")

# GPS ポイント JSON（segment_points_with_timestamps.json）
INPUT_GPS_JSON_PATH = Path("../video-overlay-renderer/data/segment_points_with_timestamps.json")

# 出力する JSON ファイル（回転後のデータ）
OUTPUT_COORDS_JSON_PATH = Path("../video-overlay-renderer/data/coords_segment_list_rotated.json")
OUTPUT_GPS_JSON_PATH = Path("../video-overlay-renderer/data/segment_points_with_timestamps_rotated.json")


def load_json(json_path: Path) -> list:
	"""JSON ファイルを読み込み、リストとして返す。"""
	
	with json_path.open("r", encoding="utf-8") as f:
		return json.load(f)


def get_start_and_end_points(
	coords: list[Tuple[float, float]],
	gps_points: list[dict],
) -> Tuple[Tuple[float, float], Tuple[float, float]]:
	"""coords と gps から開始地点と終了地点を取得する。
	
	最初の有効な座標と最後の有効な座標から、実データのある開始地点と終了地点を取得する。
	"""
	
	# 有効な座標を取得（None や重複排除）
	valid_coords = []
	prev_coord = None
	for coord in coords:
		if isinstance(coord, (list, tuple)) and len(coord) == 2:
			try:
				lat = float(coord[0])
				lon = float(coord[1])
				current = (lat, lon)
				if current != prev_coord:  # 連続した同じ座標は除外
					valid_coords.append(current)
					prev_coord = current
			except (TypeError, ValueError):
				continue
	
	if not valid_coords or len(valid_coords) < 2:
		raise ValueError("有効な座標が 2 点以上必要です")
	
	start_point = valid_coords[0]
	end_point = valid_coords[-1]
	
	print(f"[INFO] 開始地点: {start_point}")
	print(f"[INFO] 終了地点: {end_point}")
	
	return start_point, end_point


def calculate_bearing_angle(
	start_lat: float,
	start_lon: float,
	end_lat: float,
	end_lon: float,
) -> float:
	"""2 点間のベアリング角度（度数、0=北、90=東）を計算する。"""
	
	d_lon = math.radians(end_lon - start_lon)
	lat1 = math.radians(start_lat)
	lat2 = math.radians(end_lat)
	
	y = math.sin(d_lon) * math.cos(lat2)
	x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(d_lon)
	
	bearing = math.degrees(math.atan2(y, x))
	# 北を 0 度として、0-360 の範囲に正規化
	bearing = (bearing + 360) % 360
	
	return bearing


def get_rotation_angle(bearing: float) -> Tuple[int, float]:
	"""ベアリング角度から、90°単位の最適な回転角度を決定する。
	
	GPSの開始→終了ベクトルが↑方向（北向き=0°）に最も近くなる
	90°単位の回転を選択する。
	
	Returns:
		(回転度数, 調整後のベアリング角度)
	"""
	
	# 北方向（0度）に最も近い90°単位の回転を選択
	angles = [0, 90, 180, 270]
	
	# 各回転角度に対して、回転後のベアリングを計算
	angle_diffs = []
	for angle in angles:
		# 回転後のベアリング（開始→終了の方向が回転後どうなるか）
		rotated_bearing = (bearing - angle) % 360
		
		# 0度（北向き）からの差分（最小角度）
		# 360度系での最短距離を計算
		diff = min(rotated_bearing, 360 - rotated_bearing)
		angle_diffs.append((angle, diff, rotated_bearing))
	
	# 最小差分（北向きに最も近い）の回転角度を選択
	best_rotation = min(angle_diffs, key=lambda x: x[1])
	
	print(f"[INFO] ベアリング角度: {bearing:.2f}°")
	print(f"[INFO] 選択された回転: {best_rotation[0]}° (調整後: {best_rotation[2]:.2f}°)")
	
	return best_rotation[0], best_rotation[2]


def rotate_point(
	lat: float,
	lon: float,
	rotation_angle: int,
	center_lat: float,
	center_lon: float,
) -> Tuple[float, float]:
	"""中心点を基準に、座標を回転させる。
	
	注意: 緯度経度の回転は複雑なため、ここでは単純な 2D 回転を行う。
	実際の地球上の回転とは異なるが、ローカル領域では近似として十分。
	"""
	
	# 中心を原点に変換
	d_lat = lat - center_lat
	d_lon = lon - center_lon
	
	# ラジアンに変換
	angle_rad = math.radians(rotation_angle)
	
	# 2D 回転マトリックスを適用
	# (x' = x*cos(θ) - y*sin(θ), y' = x*sin(θ) + y*cos(θ))
	new_d_lon = d_lon * math.cos(angle_rad) - d_lat * math.sin(angle_rad)
	new_d_lat = d_lon * math.sin(angle_rad) + d_lat * math.cos(angle_rad)
	
	# 元の座標系に戻す
	new_lat = center_lat + new_d_lat
	new_lon = center_lon + new_d_lon
	
	return new_lat, new_lon


def rotate_coords(
	coords: list,
	rotation_angle: int,
	center_lat: float,
	center_lon: float,
) -> list:
	"""座標リストを回転させる。"""
	
	rotated_coords = []
	for coord in coords:
		if isinstance(coord, (list, tuple)) and len(coord) == 2:
			try:
				lat = float(coord[0])
				lon = float(coord[1])
				new_lat, new_lon = rotate_point(lat, lon, rotation_angle, center_lat, center_lon)
				rotated_coords.append([new_lat, new_lon])
			except (TypeError, ValueError):
				rotated_coords.append(coord)
		else:
			rotated_coords.append(coord)
	
	return rotated_coords


def rotate_gps_points(
	gps_points: list[dict],
	rotation_angle: int,
	center_lat: float,
	center_lon: float,
) -> list[dict]:
	"""GPS ポイントリストを回転させる。"""
	
	rotated_gps = []
	for point in gps_points:
		try:
			lat = float(point["lat"])
			lon = float(point["lon"])
			new_lat, new_lon = rotate_point(lat, lon, rotation_angle, center_lat, center_lon)
			
			rotated_point = point.copy()
			rotated_point["lat"] = new_lat
			rotated_point["lon"] = new_lon
			rotated_gps.append(rotated_point)
		except (KeyError, TypeError, ValueError):
			rotated_gps.append(point)
	
	return rotated_gps


def main() -> None:
	# ベースディレクトリはこのスクリプトファイルと同じ場所を想定
	base_dir = Path(__file__).resolve().parent
	
	coords_path = (base_dir / INPUT_COORDS_JSON_PATH).resolve()
	gps_path = (base_dir / INPUT_GPS_JSON_PATH).resolve()
	output_coords_path = (base_dir / OUTPUT_COORDS_JSON_PATH).resolve()
	output_gps_path = (base_dir / OUTPUT_GPS_JSON_PATH).resolve()
	
	print(f"[INFO] 座標 JSON 読み込み: {coords_path}")
	coords = load_json(coords_path)
	print(f"[INFO] 座標数: {len(coords)}")
	
	print(f"[INFO] GPS JSON 読み込み: {gps_path}")
	gps_points = load_json(gps_path)
	print(f"[INFO] GPS ポイント数: {len(gps_points)}")
	
	# 開始地点と終了地点を取得
	print("[INFO] 開始地点と終了地点を取得中...")
	start_point, end_point = get_start_and_end_points(coords, gps_points)
	
	# ベアリング角度を計算
	bearing = calculate_bearing_angle(start_point[0], start_point[1], end_point[0], end_point[1])
	
	# 回転角度を決定
	rotation_angle, adjusted_bearing = get_rotation_angle(bearing)
	
	# 開始地点を中心に回転
	print("[INFO] 座標を回転中...")
	rotated_coords = rotate_coords(coords, rotation_angle, start_point[0], start_point[1])
	
	print("[INFO] GPS ポイントを回転中...")
	rotated_gps = rotate_gps_points(gps_points, rotation_angle, start_point[0], start_point[1])
	
	# 結果を保存
	print(f"[INFO] 回転済み座標 JSON 書き出し: {output_coords_path}")
	with output_coords_path.open("w", encoding="utf-8") as f:
		json.dump(rotated_coords, f, ensure_ascii=False, indent=2)
	
	print(f"[INFO] 回転済み GPS JSON 書き出し: {output_gps_path}")
	with output_gps_path.open("w", encoding="utf-8") as f:
		json.dump(rotated_gps, f, ensure_ascii=False, indent=2)
	
	print("[INFO] 完了しました。")


if __name__ == "__main__":
	main()
