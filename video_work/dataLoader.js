// データロード用モジュール
// JSON ファイルの取得とソート済みデータ配列の生成を担当

import { loadJson, showError } from "./utils.js";

// 設定（ファイルパス）
const COORDS_URL = "coords_segment_list.json";
const ELEVATION_URL = "elevation_segment_list.json";
const SEGMENT_TS_URL = "segment_points_with_timestamps.json";

/**
 * データをロードして、長さ調整・timestamp ソート済みの配列を返す。
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

	combined.sort((a, b) => a.ts - b.ts);

	const sortedCoords = combined.map((c) => c.coord);
	const sortedElev = combined.map((c) => c.elev);
	const tsDates = combined.map((c) => c.ts);

	return { coords: sortedCoords, elevations: sortedElev, tsDates };
}
