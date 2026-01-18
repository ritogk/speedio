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
 * ベースマップ用のフィルタ定義（白グロー + 背景パネルぼかし）を作成する。
 * ベースマップ（背景・全区間ライン）で共通利用する。
 */
function createMapFilters() {
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

	return pathDefs;
}

/**
 * 座標配列から SVG 上の投影座標（ベースマップの基準）を計算する。
 * ベースマップ（全区間の形）を決める責務。
 */
function projectRouteCoords(coords, pathWidth, pathHeight, pathMargin) {
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

	return coords.map(projectCoord);
}

/**
 * ベースマップ（背景パネル + 全区間ライン）を構築する。
 * ベースマップ部分はインデックスに依存せず、静的に描画される。
 */
function createBaseMap({ pathSvg, pathWidth, pathHeight, projectedPoints, basePathWeight }) {
	// 背景パネル（少し内側に縮めて角丸を目立たせる）
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

	// 経路やマーカーをまとめて回転させるためのグループ
	const pathGroup = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"g"
	);
	pathSvg.appendChild(pathGroup);

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
	pathGroup.appendChild(baseGlowPolyline);

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
	pathGroup.appendChild(basePolyline);

	return { pathGroup };
}

/**
 * 走行ラインと現在位置マーカーのレイヤーを作成する。
 * ここが「走行ライン」責務を持ち、update 時にインデックスに応じて更新される。
 */
function createRunLayer({
	pathGroup,
	projectedPoints,
	playedPathWeight,
	markerRadius,
	markerStrokeWidth,
	markerColor,
	showPlayedPath,
	showCurrentMarker,
}) {
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
		pathGroup.appendChild(playedPolyline);
	}

	// 現在位置マーカー（オプションで非表示にできる）
	let directionArrow = null;
	if (showCurrentMarker) {
		// 進行方向を示す矢印（現在位置の点の代わり）
		directionArrow = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"path"
		);
		// 上向き（-Y 方向）を基準とした、マーカー半径ベースの小さな矢印形状
		const arrowLength = markerRadius * 1.9; // 先端までの長さ
		const arrowWidth = markerRadius * 1.0; // 左右の幅
		const arrowTail = arrowLength * 0.35; // 尾の位置
		const arrowPathD = [
			`M 0 ${-arrowLength}`,
			`L ${arrowWidth} ${arrowTail}`,
			"L 0 0",
			`L ${-arrowWidth} ${arrowTail}`,
			"Z",
		].join(" ");
		directionArrow.setAttribute("d", arrowPathD);
		directionArrow.setAttribute("fill", markerColor);
		directionArrow.setAttribute("stroke", MAP_MARKER_STROKE_COLOR);
		directionArrow.setAttribute(
			"stroke-width",
			String(markerStrokeWidth * 0.4)
		);
		directionArrow.setAttribute("stroke-linejoin", "round");
		directionArrow.setAttribute("opacity", "0");
		pathGroup.appendChild(directionArrow);
	}

	function updateRunLayer(index) {
		const i = Math.max(0, Math.min(projectedPoints.length - 1, index));
		const pt = projectedPoints[i];

		if (playedPolyline) {
			const playedPoints = projectedPoints
				.slice(0, i + 1)
				.map((p) => `${p.x},${p.y}`)
				.join(" ");
			playedPolyline.setAttribute("points", playedPoints);
		}

		// 前後の点から進行方向ベクトルを計算し、矢印を回転・配置
		if (directionArrow && projectedPoints.length > 1) {
			const prevIdx = i > 0 ? i - 1 : i;
			const nextIdx = i < projectedPoints.length - 1 ? i + 1 : i;
			const prevPt = projectedPoints[prevIdx];
			const nextPt = projectedPoints[nextIdx];
			let dx = nextPt.x - prevPt.x;
			let dy = nextPt.y - prevPt.y;
			const len = Math.hypot(dx, dy);
			if (len > 1e-6) {
				dx /= len;
				dy /= len;
				// 進行方向ベクトルに合わせて、上向き基準の矢印を回転
				const angleRad = Math.atan2(dy, dx);
				const angleDeg = (angleRad * 180) / Math.PI + 90;
				directionArrow.setAttribute(
					"transform",
					`translate(${pt.x}, ${pt.y}) rotate(${angleDeg})`
				);
				directionArrow.setAttribute("opacity", "1");
			} else {
				directionArrow.setAttribute("opacity", "0");
			}
		}

		return { index: i, point: pt };
	}

	return { updateRunLayer };
}

/**
 * ミニマップ / フルマップ共通のビューポート制御（回転 + カメラ追従）。
 *
 * - rotateToHeading: ミニマップ向け（進行方向が常に上）
 * - cameraEnabled + cameraZoom: ミニマップ用のズーム＆追従。フルマップでは無効化。
 */
function createViewportController({
	pathSvg,
	pathGroup,
	projectedPoints,
	pathWidth,
	pathHeight,
	rotateToHeading,
	cameraEnabled,
	cameraZoom,
}) {
	function applyHeadingRotation(index, pt) {
		if (!rotateToHeading) {
			pathGroup.removeAttribute("transform");
			return;
		}

		// 前後の点から進行方向ベクトルを計算
		const prevIdx = index > 0 ? index - 1 : index;
		const nextIdx = index < projectedPoints.length - 1 ? index + 1 : index;
		const prevPt = projectedPoints[prevIdx];
		const nextPt = projectedPoints[nextIdx];
		let dx = nextPt.x - prevPt.x;
		let dy = nextPt.y - prevPt.y;
		const len = Math.hypot(dx, dy);
		if (len > 1e-6) {
			dx /= len;
			dy /= len;
			// 現在の方向角
			const angleRad = Math.atan2(dy, dx);
			// 進行方向が上（画面座標で -Y 方向）を向くように回転
			const angleDeg = -90 - (angleRad * 180) / Math.PI;
			pathGroup.setAttribute(
				"transform",
				`rotate(${angleDeg}, ${pt.x}, ${pt.y})`
			);
		} else {
			pathGroup.removeAttribute("transform");
		}
	}

	function applyCameraView(pt) {
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
			// ズーム無効時は全体表示（フルマップ）
			pathSvg.setAttribute("viewBox", `0 0 ${pathWidth} ${pathHeight}`);
		}
	}

	function updateViewport(index, pt) {
		applyHeadingRotation(index, pt);
		applyCameraView(pt);
	}

	return { updateViewport };
}

/**
 * 地図用SVGに経路を描画し、インデックスに応じて現在位置と再生済み区間を更新するモジュール。
 *
 * ベースマップ（背景 + 全区間）、走行ラインレイヤー（再生済み + 現在位置）、
 * ビューポート制御（ミニマップ/フルマップ）に責務分割している。
 *
 * @param {number[][]} coords [lat, lon] の配列
 * @param {SVGSVGElement} pathSvg 対象SVG要素
 * @param {{
 *   cameraEnabled?: boolean,
 *   cameraZoom?: number,
 *   basePathWeight?: number,
 *   playedPathWeight?: number,
 *   markerRadius?: number,
 *   markerStrokeWidth?: number,
 *   markerColor?: string,
 *   showPlayedPath?: boolean,
 *   showCurrentMarker?: boolean,
 *   rotateToHeading?: boolean,
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
		markerColor = MAP_CURRENT_MARKER_COLOR,
		showPlayedPath = true,
		showCurrentMarker = true,
		// true にするとミニマップを進行方向が常に上になるように回転させる
		rotateToHeading = false,
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

	// 初期 viewBox（フルマップ全体表示）。カメラ制御で上書きされる場合あり。
	pathSvg.setAttribute("viewBox", `0 0 ${pathWidth} ${pathHeight}`);

	// ==== ベースマップ：フィルタ + 投影 + 背景 + 全区間ライン ====
	const pathDefs = createMapFilters();
	pathSvg.appendChild(pathDefs);

	const projectedPoints = projectRouteCoords(
		coords,
		pathWidth,
		pathHeight,
		pathMargin
	);

	const { pathGroup } = createBaseMap({
		pathSvg,
		pathWidth,
		pathHeight,
		projectedPoints,
		basePathWeight,
	});

	// ==== 走行ライン：再生済みライン + 現在位置マーカー ====
	const { updateRunLayer } = createRunLayer({
		pathGroup,
		projectedPoints,
		playedPathWeight,
		markerRadius,
		markerStrokeWidth,
		markerColor,
		showPlayedPath,
		showCurrentMarker,
	});

	// ==== ミニマップ / フルマップ：ビューポート制御 ====
	const { updateViewport } = createViewportController({
		pathSvg,
		pathGroup,
		projectedPoints,
		pathWidth,
		pathHeight,
		rotateToHeading,
		cameraEnabled,
		cameraZoom,
	});

	function update(index) {
		// 走行ラインを更新し、その結果得られる現在位置でビューポートを制御
		const { index: clampedIndex, point } = updateRunLayer(index);
		updateViewport(clampedIndex, point);
	}

	return { update };
}
