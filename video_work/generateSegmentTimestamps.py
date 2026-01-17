import csv
import json
import math
from pathlib import Path


# ========================
# 設定（必要に応じてここだけ編集）
# ========================

# 入力となる GPS CSV ファイル
INPUT_CSV_PATH = Path("gps_363_2026-01-11.csv")

# 入力となる区間ポイント群 JSON（coords_segment_list.json）
INPUT_SEGMENT_JSON_PATH = Path("coords_segment_list.json")

# 出力する JSON ファイル
OUTPUT_JSON_PATH = Path("segment_points_with_timestamps.json")

# CSV のカラム名
CSV_COL_TIMESTAMP = "timestamp"
CSV_COL_LAT = "latitude"
CSV_COL_LON = "longitude"

# 地球半径 [m]（ハーバーサイン距離計算用）
EARTH_RADIUS_M = 6_371_000


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
	"""2 点間のハーバーサイン距離（メートル）を返す。

	距離の絶対値よりも「どれが一番近いか」が重要なので、
	精度よりもシンプルさを優先した実装にしている。
	"""

	phi1 = math.radians(lat1)
	phi2 = math.radians(lat2)
	d_phi = math.radians(lat2 - lat1)
	d_lambda = math.radians(lon2 - lon1)

	a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
	c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
	return EARTH_RADIUS_M * c


def load_gps_points(csv_path: Path) -> list[dict]:
	"""GPS CSV を読み込み、[{timestamp, lat, lon}, ...] のリストとして返す。"""

	gps_points: list[dict] = []
	with csv_path.open("r", encoding="utf-8") as f:
		reader = csv.DictReader(f)
		for row in reader:
			try:
				lat = float(row[CSV_COL_LAT])
				lon = float(row[CSV_COL_LON])
			except (KeyError, ValueError) as e:
				# 想定外の行はスキップ
				print(f"[WARN] CSV 行の読み込みに失敗したためスキップします: {row} ({e})")
				continue

			gps_points.append(
				{
					"timestamp": row.get(CSV_COL_TIMESTAMP, ""),
					"lat": lat,
					"lon": lon,
				}
			)

	if not gps_points:
		raise ValueError(f"CSV から有効な GPS データを読み込めませんでした: {csv_path}")

	return gps_points


def load_segment_coords(json_path: Path) -> list[tuple[float, float]]:
	"""coords_segment_list.json を読み込み、[(lat, lon), ...] を返す。"""

	with json_path.open("r", encoding="utf-8") as f:
		data = json.load(f)

	coords: list[tuple[float, float]] = []
	for item in data:
		# item は [lat, lon] を想定
		if not isinstance(item, (list, tuple)) or len(item) != 2:
			print(f"[WARN] 想定外の要素形式のためスキップします: {item}")
			continue
		try:
			lat = float(item[0])
			lon = float(item[1])
		except (TypeError, ValueError) as e:
			print(f"[WARN] 座標値の変換に失敗したためスキップします: {item} ({e})")
			continue
		coords.append((lat, lon))

	if not coords:
		raise ValueError(f"JSON から有効な座標データを読み込めませんでした: {json_path}")

	return coords


def find_nearest_gps_point(
	target_lat: float,
	target_lon: float,
	gps_points: list[dict],
) -> dict:
	"""target に最も近い GPS 点（辞書）を返す。"""

	best_point: dict | None = None
	best_distance: float | None = None

	for point in gps_points:
		d = haversine_distance_m(target_lat, target_lon, point["lat"], point["lon"])
		if best_distance is None or d < best_distance:
			best_distance = d
			best_point = point

	if best_point is None:
		raise RuntimeError("GPS 点のリストが空です。")

	return best_point


def build_segment_with_timestamps(
	segment_coords: list[tuple[float, float]],
	gps_points: list[dict],
) -> list[dict]:
	"""区間ポイント群に、最も近い GPS のタイムスタンプを付与したリストを作る。"""

	result: list[dict] = []

	for idx, (lat, lon) in enumerate(segment_coords):
		nearest = find_nearest_gps_point(lat, lon, gps_points)
		result.append(
			{
				"index": idx,
				"lat": lat,
				"lon": lon,
				"timestamp": nearest["timestamp"],
			}
		)

	return result


def main() -> None:
	# ベースディレクトリはこのスクリプトファイルと同じ場所を想定
	base_dir = Path(__file__).resolve().parent

	csv_path = (base_dir / INPUT_CSV_PATH).resolve()
	seg_path = (base_dir / INPUT_SEGMENT_JSON_PATH).resolve()
	out_path = (base_dir / OUTPUT_JSON_PATH).resolve()

	print(f"[INFO] CSV 読み込み: {csv_path}")
	gps_points = load_gps_points(csv_path)
	print(f"[INFO] GPS 行数: {len(gps_points)}")

	print(f"[INFO] 区間ポイント JSON 読み込み: {seg_path}")
	segment_coords = load_segment_coords(seg_path)
	print(f"[INFO] 区間ポイント数: {len(segment_coords)}")

	print("[INFO] 最も近い GPS のタイムスタンプを付与中...")
	result = build_segment_with_timestamps(segment_coords, gps_points)

	print(f"[INFO] JSON 書き出し: {out_path}")
	with out_path.open("w", encoding="utf-8") as f:
		json.dump(result, f, ensure_ascii=False, indent=2)

	print("[INFO] 完了しました。")


if __name__ == "__main__":  # モジュールとして import された場合は実行しない
	main()

