// 全体コントローラモジュール
// 地図・標高グラフ・動画・UI の連携と再生制御を担当

// 1 = 実時間, >1 = 早送り
const PLAYBACK_SPEED = 1;

/**
 * UI 要素の初期化と再生コントロール全体をセットアップする。
 * @param {number[][]} coords
 * @param {number[]} elevations
 * @param {Date[]} tsDates
 * @param {{
 *   formatTimeLabel: (d: Date) => string,
 *   createMapGraph: import("./mapGraph.js").createMapGraph,
 *   createElevationGraph: import("./elevationGraph.js").createElevationGraph,
 *   createVideoModule: import("./videoModule.js").createVideoModule,
 *   registerZKeyToggle: import("./keyboardShortcuts.js").registerZKeyToggle,
 *   playbackSpeed?: number,
 * }} deps 依存モジュール/設定をまとめたオブジェクト
 */
export function setupController(
	coords,
	elevations,
	tsDates,
	{
		formatTimeLabel,
		createMapGraph,
		createElevationGraph,
		createVideoModule,
		registerZKeyToggle
	}
) {
	const n = coords.length;

	// DOM 取得
	const playBtn = document.getElementById("play-btn");
	const pauseBtn = document.getElementById("pause-btn");
	const slider = document.getElementById("index-slider");
	const timeLabelAbs = document.getElementById("time-label-abs");
	const playbackElapsed = document.getElementById("playback-elapsed");
	const bgVideo = document.getElementById("bg-video");
	const videoTimeSetup = document.getElementById("video-time-setup");
	const videoStartInput = document.getElementById("video-start-input");
	const videoStartApply = document.getElementById("video-start-apply");
	const controls = document.querySelector(".controls");
	const statusBar = document.querySelector(".status-bar");

	const statusIndex = document.getElementById("status-index");
	const statusElev = document.getElementById("status-elev");
	const statusLatLon = document.getElementById("status-latlon");
	const chartRange = document.getElementById("chart-range");

	// 初期フォーカスを開始位置入力に当てる
	if (videoStartInput) {
		try {
			videoStartInput.focus();
			videoStartInput.select();
		} catch (e) {
			console.warn("開始位置入力へのフォーカスに失敗しました", e);
		}
	}

	// 初期状態では動画は停止・再生ボタンは無効
	if (bgVideo) {
		try {
			bgVideo.pause();
			bgVideo.currentTime = 0;
		} catch (e) {
			console.warn("背景動画の初期化に失敗しました", e);
		}
	}
	if (playBtn) playBtn.disabled = true;
	if (pauseBtn) pauseBtn.disabled = true;

	slider.max = String(n - 1);
	slider.value = "0";

	// 時間レンジ表示
	const start = tsDates[0];
	const end = tsDates[tsDates.length - 1];
	const minMillis = start.getTime();
	const maxMillis = end.getTime();
	const elapsedSec = (maxMillis - minMillis) / 1000;
	const mm = Math.floor(elapsedSec / 60);
	const ss = Math.round(elapsedSec % 60)
		.toString()
		.padStart(2, "0");
	if (chartRange) {
		chartRange.textContent = `${formatTimeLabel(start)} → ${formatTimeLabel(
			end
		)} (約 ${mm}:${ss} 経過)`;
	}

	function formatMmSs(totalSec) {
		const s = Math.max(0, Math.floor(totalSec));
		const m = Math.floor(s / 60);
		const rem = String(s % 60).padStart(2, "0");
		return `${m}:${rem}`;
	}

	function updatePlaybackElapsed(currentMs) {
		const clamped = Math.max(minMillis, Math.min(maxMillis, currentMs));
		const elapsedNow = (clamped - minMillis) / 1000;
		playbackElapsed.textContent = `${formatMmSs(elapsedNow)} / ${formatMmSs(
			elapsedSec
		)}`;
	}

	// モジュール初期化
	const mapSvgFull = document.getElementById("path-view-full");
	const mapSvgMini = document.getElementById("path-view-mini");
	const elevSvg = document.getElementById("elevation-chart");
	// 全体表示マップ（ズームなし）
	const mapGraphFull = createMapGraph(coords, mapSvgFull, {
		cameraEnabled: false,
		cameraZoom: 1,
		showPlayedPath: true,
		showCurrentMarker: true,
	});
	// ミニマップ（現在位置を中心にズーム＆追従）
	const mapGraphMini = createMapGraph(coords, mapSvgMini, {
		cameraEnabled: true,
		cameraZoom: 12,
		basePathWeight: 0.7,
		playedPathWeight: 0.9,
		markerRadius: 1.1,
		markerStrokeWidth: 0.4,
		// ミニマップは進行方向が常に上になるように回転
		rotateToHeading: false,
	});
	const elevationGraph = createElevationGraph(elevations, n, elevSvg);
	const videoModule = createVideoModule({
		bgVideo,
		videoTimeSetup,
		videoStartInput,
		videoStartApply,
		playBtn,
		pauseBtn,
		minMillis,
	});

	// z キーで UI 表示/非表示（キーボードショートカットモジュールに委譲）
	registerZKeyToggle({
		videoTimeSetup,
		controls,
		statusBar,
		videoStartInput,
	});

	// インデックス & 再生状態
	let currentIndex = 0;
	let playing = false;
	let rafId = null;
	let playStartRealMs = 0;
	let playStartDataMs = minMillis;

	function setIndex(i, { syncVideo } = { syncVideo: false }) {
		if (i < 0) i = 0;
		if (i >= n) i = n - 1;
		currentIndex = i;
		slider.value = String(i);

		const elev = elevations[i];
		const ts = tsDates[i];
		const coord = coords[i];

		if (statusIndex) statusIndex.textContent = `${i + 1} / ${n}`;
		if (statusElev) statusElev.textContent = `${elev.toFixed(1)} m`;
		if (statusLatLon) {
			statusLatLon.textContent = `${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}`;
		}
		if (timeLabelAbs) timeLabelAbs.textContent = formatTimeLabel(ts);
		updatePlaybackElapsed(ts.getTime());

		// ビジュアル更新（全体マップ + ズームマップ）
		mapGraphFull.update(i);
		mapGraphMini.update(i);
		elevationGraph.update(i);

		// 動画同期
		if (syncVideo) {
			videoModule.syncToTimestamp(ts);
		}
	}

	function stopAnimation() {
		if (rafId != null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
	}

	function tick() {
		if (!playing) return;

		const now = performance.now();
		const elapsedRealSec = (now - playStartRealMs) / 1000;
		const targetDataMs = Math.min(
			maxMillis,
			playStartDataMs + elapsedRealSec * PLAYBACK_SPEED * 1000
		);

		let advanced = false;
		while (currentIndex < n - 1 && tsDates[currentIndex + 1].getTime() <= targetDataMs) {
			currentIndex += 1;
			setIndex(currentIndex);
			advanced = true;
		}

		const virtualDate = new Date(targetDataMs);
		if (timeLabelAbs) timeLabelAbs.textContent = formatTimeLabel(virtualDate);
		updatePlaybackElapsed(targetDataMs);

		// 終端まで到達したら停止
		if (targetDataMs >= maxMillis || currentIndex >= n - 1) {
			playing = false;
			if (playBtn) playBtn.disabled = false;
			if (pauseBtn) pauseBtn.disabled = true;
			videoModule.pause();
			stopAnimation();
			return;
		}

		rafId = requestAnimationFrame(tick);
	}

	function handlePlay() {
		if (playing) return;
		if (!videoModule.isConfigured()) return;
		// 終端にいたら先頭から
		if (currentIndex >= n - 1) {
			setIndex(0, { syncVideo: true });
		}
		playing = true;
		if (playBtn) playBtn.disabled = true;
		if (pauseBtn) pauseBtn.disabled = false;
		videoModule.play();
		playStartRealMs = performance.now();
		playStartDataMs = tsDates[currentIndex].getTime();
		rafId = requestAnimationFrame(tick);
	}

	function handlePause() {
		playing = false;
		stopAnimation();
		if (playBtn) playBtn.disabled = false;
		if (pauseBtn) pauseBtn.disabled = true;
		videoModule.pause();
	}

	if (playBtn) playBtn.addEventListener("click", handlePlay);
	if (pauseBtn) pauseBtn.addEventListener("click", handlePause);

	slider.addEventListener("input", () => {
		// スライダーを動かしたら一旦停止
		playing = false;
		stopAnimation();
		if (playBtn) playBtn.disabled = false;
		if (pauseBtn) pauseBtn.disabled = true;
		// 動画側も必ず一時停止して状態をそろえる
		videoModule.pause();

		const idx = Number(slider.value) || 0;
		setIndex(idx, { syncVideo: true });
	});

	// 初期表示（動画同期は不要）
	setIndex(0);
}
