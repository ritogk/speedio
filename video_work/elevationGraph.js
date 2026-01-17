// 標高グラフモジュール

// 調整頻度の高いレイアウト・スタイル系定数
const ELEVATION_SVG_WIDTH = 800;
const ELEVATION_SVG_HEIGHT = 220;
const ELEVATION_PADDING_LEFT = 24;
const ELEVATION_PADDING_RIGHT = 6;
const ELEVATION_PADDING_TOP = 10;
const ELEVATION_PADDING_BOTTOM = 18;
const ELEVATION_GLOW_STD_DEVIATION = 1.5;
const ELEVATION_AXIS_COLOR = "#4b5563";
const ELEVATION_AXIS_STROKE_WIDTH = 1;
const ELEVATION_BASE_COLOR = "#ffffff";
const ELEVATION_BASE_STROKE_WIDTH = 1.5;
const ELEVATION_BASE_GLOW_COLOR = "#4b5563";
const ELEVATION_BASE_GLOW_WIDTH = 3;
const ELEVATION_BASE_GLOW_OPACITY = 0.5;
const ELEVATION_PLAYED_COLOR = "#f97316";
const ELEVATION_PLAYED_WIDTH = 2;
const ELEVATION_CURSOR_COLOR = "#fbbf24";
const ELEVATION_CURSOR_WIDTH = 2;
const ELEVATION_CURSOR_MARGIN_TOP = 2;
const ELEVATION_CURSOR_MARGIN_BOTTOM = 2;

/**
 * 標高SVGにプロファイルを描画し、インデックスに応じてカーソルと再生済み区間を更新するモジュール。
 * @param {number[]} elevations 標高配列
 * @param {number} n データ数
 * @param {SVGSVGElement} svg 対象SVG要素
 */
export function createElevationGraph(elevations, n, svg) {
	if (!svg || !elevations || elevations.length === 0) {
		return {
			update() {},
		};
	}

	const width = ELEVATION_SVG_WIDTH;
	const height = ELEVATION_SVG_HEIGHT;
	const paddingLeft = ELEVATION_PADDING_LEFT;
	const paddingRight = ELEVATION_PADDING_RIGHT;
	const paddingTop = ELEVATION_PADDING_TOP;
	const paddingBottom = ELEVATION_PADDING_BOTTOM;

	const chartWidth = width - paddingLeft - paddingRight;
	const chartHeight = height - paddingTop - paddingBottom;
	const elevPoints = [];

	const minElev = Math.min(...elevations);
	const maxElev = Math.max(...elevations);

	// 標高ライン用の白いグロー用フィルタ定義
	const chartDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
	const chartGlowFilter = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"filter"
	);
	chartGlowFilter.setAttribute("id", "white-glow-elev");
	chartGlowFilter.setAttribute("x", "-50%");
	chartGlowFilter.setAttribute("y", "-50%");
	chartGlowFilter.setAttribute("width", "200%");
	chartGlowFilter.setAttribute("height", "200%");
	const chartGlowBlur = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"feGaussianBlur"
	);
	// 標高側もぼかしを弱めに
	chartGlowBlur.setAttribute("stdDeviation", String(ELEVATION_GLOW_STD_DEVIATION));
	chartGlowFilter.appendChild(chartGlowBlur);
	chartDefs.appendChild(chartGlowFilter);
	svg.appendChild(chartDefs);

	const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	bg.setAttribute("x", "0");
	bg.setAttribute("y", "0");
	bg.setAttribute("width", String(width));
	bg.setAttribute("height", String(height));
	bg.setAttribute("fill", "none");
	svg.appendChild(bg);

	// 軸っぽいライン
	const axis = document.createElementNS("http://www.w3.org/2000/svg", "line");
	axis.setAttribute("x1", paddingLeft);
	axis.setAttribute("x2", width - paddingRight);
	axis.setAttribute("y1", height - paddingBottom);
	axis.setAttribute("y2", height - paddingBottom);
	axis.setAttribute("stroke", ELEVATION_AXIS_COLOR);
	axis.setAttribute("stroke-width", String(ELEVATION_AXIS_STROKE_WIDTH));
	axis.setAttribute("stroke-linecap", "round");
	svg.appendChild(axis);

	// 標高線のパス（ベース）
	const basePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
	const dParts = [];
	for (let i = 0; i < n; i++) {
		const x = paddingLeft + (i / Math.max(1, n - 1)) * chartWidth;
		const t = (elevations[i] - minElev) / Math.max(1, maxElev - minElev);
		const y = paddingTop + (1 - t) * chartHeight;
		dParts.push(`${i === 0 ? "M" : "L"}${x},${y}`);
		elevPoints.push({ x, y });
	}
	// 白いグローのパス（ベースラインの背後）
	const baseGlowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
	baseGlowPath.setAttribute("d", dParts.join(" "));
	baseGlowPath.setAttribute("fill", "none");
	// グローは元のライン色（グレー）
	baseGlowPath.setAttribute("stroke", ELEVATION_BASE_GLOW_COLOR);
	// 太さを控えめに
	baseGlowPath.setAttribute("stroke-width", String(ELEVATION_BASE_GLOW_WIDTH));
	baseGlowPath.setAttribute("stroke-linecap", "round");
	baseGlowPath.setAttribute("stroke-linejoin", "round");
	baseGlowPath.setAttribute("opacity", String(ELEVATION_BASE_GLOW_OPACITY));
	baseGlowPath.setAttribute("filter", "url(#white-glow-elev)");
	svg.appendChild(baseGlowPath);

	basePath.setAttribute("d", dParts.join(" "));
	basePath.setAttribute("fill", "none");
	// 実線の色を白に
	basePath.setAttribute("stroke", ELEVATION_BASE_COLOR);
	// 少しだけ細く
	basePath.setAttribute("stroke-width", String(ELEVATION_BASE_STROKE_WIDTH));
	svg.appendChild(basePath);

	// 再生済み部分のパス（オレンジ）
	const playedElevPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
	playedElevPath.setAttribute("fill", "none");
	playedElevPath.setAttribute("stroke", ELEVATION_PLAYED_COLOR);
	playedElevPath.setAttribute("stroke-width", String(ELEVATION_PLAYED_WIDTH));
	svg.appendChild(playedElevPath);

	// 現在位置カーソル
	const cursor = document.createElementNS("http://www.w3.org/2000/svg", "line");
	cursor.setAttribute("y1", paddingTop - ELEVATION_CURSOR_MARGIN_TOP);
	cursor.setAttribute("y2", height - paddingBottom + ELEVATION_CURSOR_MARGIN_BOTTOM);
	cursor.setAttribute("stroke", ELEVATION_CURSOR_COLOR);
	cursor.setAttribute("stroke-width", String(ELEVATION_CURSOR_WIDTH));
	cursor.setAttribute("stroke-linecap", "round");
	svg.appendChild(cursor);

	function update(index) {
		const i = Math.max(0, Math.min(elevPoints.length - 1, index));
		const x = paddingLeft + (i / Math.max(1, n - 1)) * chartWidth;
		cursor.setAttribute("x1", x);
		cursor.setAttribute("x2", x);

		const elevDParts = [];
		for (let j = 0; j <= i; j++) {
			const pt = elevPoints[j];
			if (!pt) continue;
			elevDParts.push(`${j === 0 ? "M" : "L"}${pt.x},${pt.y}`);
		}
		playedElevPath.setAttribute("d", elevDParts.join(" "));
	}

	return { update };
}
