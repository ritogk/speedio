// 地図グラフモジュール

// 調整頻度の高いレイアウト・スタイル系定数
const MAP_SVG_WIDTH = 800;
const MAP_SVG_HEIGHT = 600;
const MAP_MARGIN = 30;
const MAP_GLOW_STD_DEVIATION = 1.8;
const MAP_BASE_GLOW_OPACITY = 0.5;
const MAP_BASE_STROKE_COLOR = "#ffffff";
const MAP_BASE_STROKE_OPACITY = 0.8;
const MAP_PLAYED_OPACITY = 0.95;
// 現在位置マーカーの大きさ（半径）と枠線の太さ
const MAP_MARKER_RADIUS = 7;
const MAP_MARKER_STROKE_COLOR = "#111827";
const MAP_MARKER_STROKE_WIDTH = 3;
// 背景パネル（黒ぼかし）の不透明度：小さいほど透ける
const MAP_PANEL_OPACITY = 0.2;
// 現在位置マーカーの色
const MAP_CURRENT_MARKER_COLOR = "#ff0000";
// ベースライン（全区間）のスタイル
const MAP_BASE_PATH_COLOR = "#4b5563";
const MAP_BASE_PATH_WEIGHT = 4;
// 再生済みラインのスタイル
const MAP_PLAYED_PATH_COLOR = "#f97316";
const MAP_PLAYED_PATH_WEIGHT = 5;
// カメラ風ズーム設定のデフォルト（1ならズームなし）
const MAP_CAMERA_ZOOM_DEFAULT = 2.5;
const MAP_CAMERA_ENABLED_DEFAULT = true;

/**
 * 地図用SVGに経路を描画し、インデックスに応じて現在位置と再生済み区間を更新するモジュール。
 * @param {number[][]} coords [lat, lon] の配列
 * @param {SVGSVGElement} pathSvg 対象SVG要素
 * @param {{
 *   cameraEnabled?: boolean,
 *   cameraZoom?: number,
 *   basePathWeight?: number,
 *   playedPathWeight?: number,
 *   markerRadius?: number,
 *   markerStrokeWidth?: number,
 *   showPlayedPath?: boolean,
 *   showCurrentMarker?: boolean,
 * }} [options]
 */
export function createMapGraph(
	coords,
	pathSvg,
	{
		cameraEnabled = MAP_CAMERA_ENABLED_DEFAULT,
		cameraZoom = MAP_CAMERA_ZOOM_DEFAULT,
		basePathWeight = MAP_BASE_PATH_WEIGHT,
		playedPathWeight = MAP_PLAYED_PATH_WEIGHT,
		markerRadius = MAP_MARKER_RADIUS,
		markerStrokeWidth = MAP_MARKER_STROKE_WIDTH,
		showPlayedPath = true,
		showCurrentMarker = true,
	} = {}
) {
	if (!pathSvg || !coords || coords.length === 0) {
		return {
			update() {},
		};
	}

	const pathWidth = MAP_SVG_WIDTH;
	const pathHeight = MAP_SVG_HEIGHT;
	const pathMargin = MAP_MARGIN;
	pathSvg.setAttribute("viewBox", `0 0 ${pathWidth} ${pathHeight}`);

	// フィルタ定義（ルート用の白グロー + 背景パネル用の黒ぼかし）
	const pathDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
	const pathGlowFilter = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"filter"
	);
	pathGlowFilter.setAttribute("id", "white-glow-map");
	pathGlowFilter.setAttribute("x", "-50%");
	pathGlowFilter.setAttribute("y", "-50%");
	pathGlowFilter.setAttribute("width", "200%");
	pathGlowFilter.setAttribute("height", "200%");
	const pathGlowBlur = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"feGaussianBlur"
	);
	// ぼかしを弱めに
	pathGlowBlur.setAttribute("stdDeviation", String(MAP_GLOW_STD_DEVIATION));
	pathGlowFilter.appendChild(pathGlowBlur);
	pathDefs.appendChild(pathGlowFilter);

	// 背景パネル用の黒ぼかしフィルタ
	const panelBlurFilter = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"filter"
	);
	panelBlurFilter.setAttribute("id", "panel-blur-map");
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
	pathDefs.appendChild(panelBlurFilter);

	pathSvg.appendChild(pathDefs);

	const lats = coords.map((c) => c[0]);
	const lons = coords.map((c) => c[1]);
	const minLat = Math.min(...lats);
	const maxLat = Math.max(...lats);
	const minLon = Math.min(...lons);
	const maxLon = Math.max(...lons);

	// データの縦横比を保ったまま、描画領域いっぱいに収まるようにスケールを計算
	const lonSpan = maxLon - minLon || 1;
	const latSpan = maxLat - minLat || 1;
	const innerWidth = pathWidth - pathMargin * 2;
	const innerHeight = pathHeight - pathMargin * 2;
	// 両方向で共通のスケール（＝縮尺）を使うことで、形が縦横に伸び縮みしないようにする
	const scale = Math.min(innerWidth / lonSpan, innerHeight / latSpan);
	// 余白分は中心に寄せる
	const usedWidth = lonSpan * scale;
	const usedHeight = latSpan * scale;
	const offsetX = pathMargin + (innerWidth - usedWidth) / 2;
	const offsetY = pathMargin + (innerHeight - usedHeight) / 2;

	function projectCoord(coord) {
		const [lat, lon] = coord;
		const x = (lon - minLon) * scale + offsetX;
		// 緯度は北が上になるように maxLat からの差分で計算
		const y = (maxLat - lat) * scale + offsetY;
		return { x, y };
	}

	const projectedPoints = coords.map(projectCoord);

	// 背景（少し内側に縮めて角丸を目立たせる）
	const pathBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	const panelInset = 18;
	pathBg.setAttribute("x", String(panelInset));
	pathBg.setAttribute("y", String(panelInset));
	pathBg.setAttribute("width", String(pathWidth - panelInset * 2));
	pathBg.setAttribute("height", String(pathHeight - panelInset * 2));
	// 地図パネルの透明度は定数で調整
	pathBg.setAttribute("fill", "#000000");
	pathBg.setAttribute("fill-opacity", String(MAP_PANEL_OPACITY));
	pathBg.setAttribute("rx", "24");
	pathBg.setAttribute("ry", "24");
	pathBg.setAttribute("filter", "url(#panel-blur-map)");
	pathSvg.appendChild(pathBg);

	// 全区間パス（白いグロー + 実線）
	const baseGlowPolyline = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"polyline"
	);
	baseGlowPolyline.setAttribute(
		"points",
		projectedPoints.map((p) => `${p.x},${p.y}`).join(" ")
	);
	baseGlowPolyline.setAttribute("fill", "none");
	// グローは元のライン色（グレー）
	baseGlowPolyline.setAttribute("stroke", MAP_BASE_PATH_COLOR);
	baseGlowPolyline.setAttribute(
		"stroke-width",
		// 元のラインよりわずかに太い程度に抑える
		String(basePathWeight * 1.6)
	);
	baseGlowPolyline.setAttribute("stroke-linecap", "round");
	baseGlowPolyline.setAttribute("stroke-linejoin", "round");
	// 少しだけ強めの不透明度にして白っぽさを出す
	baseGlowPolyline.setAttribute("opacity", String(MAP_BASE_GLOW_OPACITY));
	baseGlowPolyline.setAttribute("filter", "url(#white-glow-map)");
	pathSvg.appendChild(baseGlowPolyline);

	const basePolyline = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"polyline"
	);
	basePolyline.setAttribute(
		"points",
		projectedPoints.map((p) => `${p.x},${p.y}`).join(" ")
	);
	basePolyline.setAttribute("fill", "none");
	// 実線の色を白に（やや細め）
	basePolyline.setAttribute("stroke", MAP_BASE_STROKE_COLOR);
	basePolyline.setAttribute("stroke-width", String(basePathWeight * 0.7));
	basePolyline.setAttribute("stroke-linecap", "round");
	basePolyline.setAttribute("stroke-linejoin", "round");
	basePolyline.setAttribute("opacity", String(MAP_BASE_STROKE_OPACITY));
	pathSvg.appendChild(basePolyline);

	// 再生済みパス（オプションで非表示にできる）
	let playedPolyline = null;
	if (showPlayedPath) {
		playedPolyline = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"polyline"
		);
		playedPolyline.setAttribute("fill", "none");
		playedPolyline.setAttribute("stroke", MAP_PLAYED_PATH_COLOR);
		playedPolyline.setAttribute("stroke-width", String(playedPathWeight));
		playedPolyline.setAttribute("stroke-linecap", "round");
		playedPolyline.setAttribute("stroke-linejoin", "round");
		playedPolyline.setAttribute("opacity", String(MAP_PLAYED_OPACITY));
		pathSvg.appendChild(playedPolyline);
	}

	// 現在位置マーカー（オプションで非表示にできる）
	let currentMarker = null;
	if (showCurrentMarker) {
		currentMarker = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"circle"
		);
		currentMarker.setAttribute("r", String(markerRadius));
		currentMarker.setAttribute("stroke", MAP_MARKER_STROKE_COLOR);
		currentMarker.setAttribute("stroke-width", String(markerStrokeWidth));
		currentMarker.setAttribute("fill", MAP_CURRENT_MARKER_COLOR);
		pathSvg.appendChild(currentMarker);
	}

	function update(index) {
		const i = Math.max(0, Math.min(projectedPoints.length - 1, index));
		const pt = projectedPoints[i];
		if (currentMarker) {
			currentMarker.setAttribute("cx", String(pt.x));
			currentMarker.setAttribute("cy", String(pt.y));
		}

		if (playedPolyline) {
			const playedPoints = projectedPoints
				.slice(0, i + 1)
				.map((p) => `${p.x},${p.y}`)
				.join(" ");
			playedPolyline.setAttribute("points", playedPoints);
		}

		// レースゲームのミニマップ風に、現在位置を中心にズーム＆追従
		if (cameraEnabled && cameraZoom > 1) {
			const viewW = pathWidth / cameraZoom;
			const viewH = pathHeight / cameraZoom;
			let viewX = pt.x - viewW / 2;
			let viewY = pt.y - viewH / 2;

			// viewBox が SVG 全体からはみ出しすぎないようにクランプ
			viewX = Math.max(0, Math.min(pathWidth - viewW, viewX));
			viewY = Math.max(0, Math.min(pathHeight - viewH, viewY));

			pathSvg.setAttribute(
				"viewBox",
				`${viewX} ${viewY} ${viewW} ${viewH}`
			);
		} else {
			// ズーム無効時は全体表示
			pathSvg.setAttribute("viewBox", `0 0 ${pathWidth} ${pathHeight}`);
		}
	}

	return { update };
}
