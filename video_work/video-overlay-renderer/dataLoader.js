// データロード用モジュール
// JSON ファイルの取得と長さ調整済みデータ配列の生成を担当

import { loadJson, showError } from "./utils.js";

// 設定（ファイルパス）
const COORDS_URL = "data/coords_segment_list_rotated.json";
const ELEVATION_URL = "data/elevation_segment_list.json";
// タイムスタンプ付き区間ポイントは data ディレクトリ配下に配置
const SEGMENT_TS_URL = "data/segment_points_with_timestamps_rotated.json";

/**
 * データをロードして、長さ調整済みの配列を返す。
 * エラー時は showError を呼び、throw で呼び出し側に通知する。
 *
 * @returns {Promise<{ coords: number[][], elevations: number[], tsDates: Date[] }>}
 */
export async function loadSortedTrackData() {
	const [coords, elevations, segmentTs] = await Promise.all([
		loadJson(COORDS_URL),
		loadJson(ELEVATION_URL),
		loadJson(SEGMENT_TS_URL),
	]);

	if (!Array.isArray(coords) || !Array.isArray(elevations) || !Array.isArray(segmentTs)) {
		const msg = "JSON フォーマットが配列ではありません。";
		showError(msg);
		throw new Error(msg);
	}

	const length = Math.min(coords.length, elevations.length, segmentTs.length);
	if (length === 0) {
		const msg = "有効なデータがありません。";
		showError(msg);
		throw new Error(msg);
	}

	if (coords.length !== elevations.length || coords.length !== segmentTs.length) {
		showError(
			`配列長が一致しません: coords=${coords.length}, elevation=${
				elevations.length
			}, ts=${segmentTs.length}。 最小の ${length} 個のみを使用します。`
		);
	}

	const slicedCoords = coords.slice(0, length);
	const slicedElev = elevations.slice(0, length);
	const slicedTs = segmentTs.slice(0, length);

	const combined = [];
	for (let i = 0; i < length; i++) {
		const tsStr = slicedTs[i].timestamp;
		const tsDate = new Date(tsStr);
		if (!tsStr || Number.isNaN(tsDate.getTime())) {
			console.warn("無効な timestamp をスキップします", slicedTs[i]);
			continue;
		}
		combined.push({ coord: slicedCoords[i], elev: slicedElev[i], ts: tsDate });
	}

	if (combined.length === 0) {
		const msg = "有効な timestamp を含むデータがありません。";
		showError(msg);
		throw new Error(msg);
	}

	// 先頭と末尾の timestamp を比較して、明らかに逆順なら全体を反転する
	// （shape はそのまま・進行方向だけ揃える）
	const firstTs = combined[0].ts.getTime();
	const lastTs = combined[combined.length - 1].ts.getTime();
	if (firstTs > lastTs) {
		console.warn("track data appears reversed by timestamp order. Reversing arrays.");
		combined.reverse();
	}

	const sortedCoords = combined.map((c) => c.coord);
	const sortedElev = combined.map((c) => c.elev);
	const tsDates = combined.map((c) => c.ts);

	return { coords: sortedCoords, elevations: sortedElev, tsDates };
}
