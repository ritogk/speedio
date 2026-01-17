// 標高グラフモジュール

// 調整頻度の高いレイアウト・スタイル系定数
const ELEVATION_SVG_WIDTH = 800;
const ELEVATION_SVG_HEIGHT = 220;
// 標高の縦方向スケール（1より小さくすると低く見える）
const ELEVATION_VERTICAL_SCALE = 0.6;
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
const ELEVATION_CURSOR_COLOR = "rgba(251, 191, 36, 0.6)";
const ELEVATION_CURSOR_WIDTH = 2;
const ELEVATION_CURSOR_MARGIN_TOP = 2;
const ELEVATION_CURSOR_MARGIN_BOTTOM = 2;
// 背景パネル（黒ぼかし）の不透明度：小さいほど透ける
const ELEVATION_PANEL_OPACITY = 0.2;

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
	const chartHeightFull = height - paddingTop - paddingBottom;
	const chartHeight = chartHeightFull * ELEVATION_VERTICAL_SCALE;
	const verticalOffset = chartHeightFull - chartHeight;
	const elevPoints = [];

	const minElev = Math.min(...elevations);
	const maxElev = Math.max(...elevations);

	// 標高ライン用の白いグロー用フィルタ定義 + パネル用のぼかしフィルタ
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

	// 背景パネル用の黒ぼかしフィルタ
	const panelBlurFilter = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"filter"
	);
	panelBlurFilter.setAttribute("id", "panel-blur-elev");
	panelBlurFilter.setAttribute("x", "-10%");
	panelBlurFilter.setAttribute("y", "-10%");
	panelBlurFilter.setAttribute("width", "120%");
	panelBlurFilter.setAttribute("height", "120%");
	const panelBlur = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"feGaussianBlur"
	);
	panelBlur.setAttribute("stdDeviation", "6");
	panelBlurFilter.appendChild(panelBlur);
	chartDefs.appendChild(panelBlurFilter);

	svg.appendChild(chartDefs);

	const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	const panelInset = 8;
	bg.setAttribute("x", String(panelInset));
	bg.setAttribute("y", String(panelInset));
	bg.setAttribute("width", String(width - panelInset * 2));
	bg.setAttribute("height", String(height - panelInset * 2));
	// 背景パネルの透明度は定数で調整
	bg.setAttribute("fill", "#000000");
	bg.setAttribute("fill-opacity", String(ELEVATION_PANEL_OPACITY));
	bg.setAttribute("rx", "16");
	bg.setAttribute("ry", "16");
	bg.setAttribute("filter", "url(#panel-blur-elev)");
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
		// 縦方向の振れ幅をスケールし、下端側に寄せる
		const y = paddingTop + verticalOffset + (1 - t) * chartHeight;
		dParts.push(`${i === 0 ? "M" : "L"}${x},${y}`);
		elevPoints.push({ x, y });
	}

	// データ端位置に縦ライン（軸と同色）
	// グラフの見え方に合わせて、配列先頭側の x に描画
	if (elevPoints.length > 0) {
		const edge = elevPoints[0];
		const edgeLine = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"line"
		);
		edgeLine.setAttribute("x1", String(edge.x));
		edgeLine.setAttribute("x2", String(edge.x));
		edgeLine.setAttribute("y1", String(paddingTop));
		edgeLine.setAttribute("y2", String(height - paddingBottom));
		edgeLine.setAttribute("stroke", ELEVATION_AXIS_COLOR);
		edgeLine.setAttribute(
			"stroke-width",
			String(ELEVATION_AXIS_STROKE_WIDTH)
		);
		edgeLine.setAttribute("stroke-linecap", "round");
		svg.appendChild(edgeLine);
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
