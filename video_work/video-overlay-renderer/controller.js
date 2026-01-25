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
 *   registerFullmapToggle: import("./keyboardShortcuts.js").registerFullmapToggle,
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
		registerZKeyToggle,
		registerFullmapToggle
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
	const fullmapBtn = document.getElementById("fullmap-btn");
	const fullmapContainer = document.getElementById("fullmap-container");
	const mainLayout = document.querySelector(".main-layout");

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
	if (playBtn) playBtn.disabled = false; // 動画がなくても再生可能に
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
		const timeStr = `${formatMmSs(elapsedNow)} / ${formatMmSs(elapsedSec)}`;
		playbackElapsed.textContent = timeStr;
		if (playbackElapsedFullscreen) {
			playbackElapsedFullscreen.textContent = timeStr;
		}
	}

	// モジュール初期化
	const mapSvgFull = document.getElementById("path-view-full");
	const mapSvgFullscreen = document.getElementById("path-view-full-fullscreen");
	const mapSvgMini = document.getElementById("path-view-mini");
	const elevSvg = document.getElementById("elevation-chart");
	// 全体表示マップ（ズームなし）
	const mapGraphFull = createMapGraph(coords, mapSvgFull, {
		cameraEnabled: false,
		cameraZoom: 1,
		showPlayedPath: true,
		showCurrentMarker: true,
		basePathWeight: 10,
		playedPathWeight: 11.5,
	});
	// 全画面用マップ
	const mapGraphFullscreen = mapSvgFullscreen ? createMapGraph(coords, mapSvgFullscreen, {
		cameraEnabled: false,
		cameraZoom: 1,
		showPlayedPath: true,
		showCurrentMarker: true,
		basePathWeight: 10,
		playedPathWeight: 11.5,
	}) : null;
	// ミニマップ（現在位置を中心にズーム＆追従）
	const mapGraphMini = createMapGraph(coords, mapSvgMini, {
		cameraEnabled: true,
		cameraZoom: 12,
		basePathWeight: 0.7,
		playedPathWeight: 0.9,
		markerRadius: 1.5,
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

	// f キーで full-map 全画面表示を切り替える
	registerFullmapToggle({
		fullmapContainer,
		mainLayout,
	});

	// 全画面ボタンクリック
	if (fullmapBtn) {
		fullmapBtn.addEventListener("click", () => {
			if (fullmapContainer) {
				const isFullmap = fullmapContainer.style.display !== "none";
				fullmapContainer.style.display = isFullmap ? "none" : "flex";
				if (mainLayout) {
					mainLayout.style.display = isFullmap ? "flex" : "none";
				}
			}
		});
	}

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
		if (sliderFullscreen) sliderFullscreen.value = String(i);

		const elev = elevations[i];
		const ts = tsDates[i];
		const coord = coords[i];

		if (statusIndex) statusIndex.textContent = `${i + 1} / ${n}`;
		if (statusElev) statusElev.textContent = `${elev.toFixed(1)} m`;
		if (statusLatLon) {
			statusLatLon.textContent = `${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}`;
		}
		if (timeLabelAbs) timeLabelAbs.textContent = formatTimeLabel(ts);
		if (timeLabelAbsFullscreen) timeLabelAbsFullscreen.textContent = formatTimeLabel(ts);
		updatePlaybackElapsed(ts.getTime());
		
		// 全画面モードの再生時間も更新
		if (playbackElapsedFullscreen) {
			const clamped = Math.max(minMillis, Math.min(maxMillis, ts.getTime()));
			const elapsedNow = (clamped - minMillis) / 1000;
			playbackElapsedFullscreen.textContent = `${formatMmSs(elapsedNow)} / ${formatMmSs(elapsedSec)}`;
		}

		// ビジュアル更新（全体マップ + ズームマップ + 全画面マップ）
		mapGraphFull.update(i);
		if (mapGraphFullscreen) mapGraphFullscreen.update(i);
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
		// 終端にいたら先頭から
		if (currentIndex >= n - 1) {
			setIndex(0, { syncVideo: videoModule.isConfigured() });
		}
		playing = true;
		if (playBtn) playBtn.disabled = true;
		if (pauseBtn) pauseBtn.disabled = false;
		if (videoModule.isConfigured()) {
			videoModule.play();
		}
		playStartRealMs = performance.now();
		playStartDataMs = tsDates[currentIndex].getTime();
		rafId = requestAnimationFrame(tick);
	}

	function handlePause() {
		playing = false;
		stopAnimation();
		if (playBtn) playBtn.disabled = false;
		if (pauseBtn) pauseBtn.disabled = true;
		const playBtnFullscreen = document.getElementById("play-btn-fullscreen");
		const pauseBtnFullscreen = document.getElementById("pause-btn-fullscreen");
		if (playBtnFullscreen) playBtnFullscreen.disabled = false;
		if (pauseBtnFullscreen) pauseBtnFullscreen.disabled = true;
		videoModule.pause();
	}

	if (playBtn) playBtn.addEventListener("click", handlePlay);
	if (pauseBtn) pauseBtn.addEventListener("click", handlePause);

	// 全画面モード用のボタンイベント
	const playBtnFullscreen = document.getElementById("play-btn-fullscreen");
	const pauseBtnFullscreen = document.getElementById("pause-btn-fullscreen");
	const sliderFullscreen = document.getElementById("index-slider-fullscreen");
	const playbackElapsedFullscreen = document.getElementById("playback-elapsed-fullscreen");
	const timeLabelAbsFullscreen = document.getElementById("time-label-abs-fullscreen");

	if (playBtnFullscreen) playBtnFullscreen.addEventListener("click", handlePlay);
	if (pauseBtnFullscreen) pauseBtnFullscreen.addEventListener("click", handlePause);

	if (sliderFullscreen) {
		sliderFullscreen.addEventListener("input", () => {
			// スライダーを動かしたら一旦停止
			playing = false;
			stopAnimation();
			if (playBtn) playBtn.disabled = false;
			if (pauseBtn) pauseBtn.disabled = true;
			if (playBtnFullscreen) playBtnFullscreen.disabled = false;
			if (pauseBtnFullscreen) pauseBtnFullscreen.disabled = true;
			// 動画側も必ず一時停止して状態をそろえる
			videoModule.pause();

			const idx = Number(sliderFullscreen.value) || 0;
			setIndex(idx, { syncVideo: true });
		});
	}

	slider.addEventListener("input", () => {
		// スライダーを動かしたら一旦停止
		playing = false;
		stopAnimation();
		if (playBtn) playBtn.disabled = false;
		if (pauseBtn) pauseBtn.disabled = true;
		if (playBtnFullscreen) playBtnFullscreen.disabled = false;
		if (pauseBtnFullscreen) pauseBtnFullscreen.disabled = true;
		// 動画側も必ず一時停止して状態をそろえる
		videoModule.pause();

		const idx = Number(slider.value) || 0;
		setIndex(idx, { syncVideo: true });
	});

	// 再生時の表示を両モードで同期する関数
	const updateBothModesPlayState = (isPlaying) => {
		if (playBtn) playBtn.disabled = isPlaying;
		if (pauseBtn) pauseBtn.disabled = !isPlaying;
		if (playBtnFullscreen) playBtnFullscreen.disabled = isPlaying;
		if (pauseBtnFullscreen) pauseBtnFullscreen.disabled = !isPlaying;
	};

	// handlePlayを修正して両モードのボタン状態を更新
	const originalHandlePlay = handlePlay;
	handlePlay = function() {
		if (playing) return;
		if (currentIndex >= n - 1) {
			setIndex(0, { syncVideo: videoModule.isConfigured() });
		}
		playing = true;
		updateBothModesPlayState(true);
		if (videoModule.isConfigured()) {
			videoModule.play();
		}
		playStartRealMs = performance.now();
		playStartDataMs = tsDates[currentIndex].getTime();
		rafId = requestAnimationFrame(tick);
	};

	// 初期表示（動画同期は不要）
	setIndex(0);
}
