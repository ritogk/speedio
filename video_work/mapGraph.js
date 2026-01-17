// 地図グラフモジュール

/**
 * 地図用SVGに経路を描画し、インデックスに応じて現在位置と再生済み区間を更新するモジュール。
 * @param {number[][]} coords [lat, lon] の配列
 * @param {SVGSVGElement} pathSvg 対象SVG要素
 * @param {Object} style MAP_STYLE 相当のスタイル設定
 */
export function createMapGraph(coords, pathSvg, style) {
	if (!pathSvg || !coords || coords.length === 0) {
		return {
			update() {},
		};
	}

	const pathWidth = 800;
	const pathHeight = 600;
	const pathMargin = 30;
	pathSvg.setAttribute("viewBox", `0 0 ${pathWidth} ${pathHeight}`);

	// フィルタ定義
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
	pathGlowBlur.setAttribute("stdDeviation", "1.8");
	pathGlowFilter.appendChild(pathGlowBlur);
	pathDefs.appendChild(pathGlowFilter);
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

	// 背景
	const pathBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	pathBg.setAttribute("x", "0");
	pathBg.setAttribute("y", "0");
	pathBg.setAttribute("width", String(pathWidth));
	pathBg.setAttribute("height", String(pathHeight));
	pathBg.setAttribute("fill", "none");
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
	baseGlowPolyline.setAttribute("stroke", style.basePathColor);
	baseGlowPolyline.setAttribute(
		"stroke-width",
		// 元のラインよりわずかに太い程度に抑える
		String(style.basePathWeight * 1.6)
	);
	baseGlowPolyline.setAttribute("stroke-linecap", "round");
	baseGlowPolyline.setAttribute("stroke-linejoin", "round");
	// 少しだけ強めの不透明度にして白っぽさを出す
	baseGlowPolyline.setAttribute("opacity", "0.5");
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
	basePolyline.setAttribute("stroke", "#ffffff");
	basePolyline.setAttribute("stroke-width", String(style.basePathWeight * 0.7));
	basePolyline.setAttribute("stroke-linecap", "round");
	basePolyline.setAttribute("stroke-linejoin", "round");
	basePolyline.setAttribute("opacity", "0.8");
	pathSvg.appendChild(basePolyline);

	// 再生済みパス
	const playedPolyline = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"polyline"
	);
	playedPolyline.setAttribute("fill", "none");
	playedPolyline.setAttribute("stroke", style.playedPathColor);
	playedPolyline.setAttribute("stroke-width", String(style.playedPathWeight));
	playedPolyline.setAttribute("stroke-linecap", "round");
	playedPolyline.setAttribute("stroke-linejoin", "round");
	playedPolyline.setAttribute("opacity", "0.95");
	pathSvg.appendChild(playedPolyline);

	// 現在位置マーカー
	const currentMarker = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"circle"
	);
	currentMarker.setAttribute("r", "5");
	currentMarker.setAttribute("stroke", "#111827");
	currentMarker.setAttribute("stroke-width", "2");
	currentMarker.setAttribute("fill", style.currentMarkerColor);
	pathSvg.appendChild(currentMarker);

	function update(index) {
		const i = Math.max(0, Math.min(projectedPoints.length - 1, index));
		const pt = projectedPoints[i];
		currentMarker.setAttribute("cx", String(pt.x));
		currentMarker.setAttribute("cy", String(pt.y));

		const playedPoints = projectedPoints
			.slice(0, i + 1)
			.map((p) => `${p.x},${p.y}`)
			.join(" ");
		playedPolyline.setAttribute("points", playedPoints);
	}

	return { update };
}
