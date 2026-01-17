// 動画制御モジュール

import { parseTimeToSeconds } from "./utils.js";

/**
 * 背景動画の開始位置設定・シーク・再生/一時停止をまとめたモジュール。
 * @param {Object} options
 * @param {HTMLVideoElement} options.bgVideo
 * @param {HTMLElement} options.videoTimeSetup
 * @param {HTMLInputElement} options.videoStartInput
 * @param {HTMLButtonElement} options.videoStartApply
 * @param {HTMLButtonElement} options.playBtn
 * @param {HTMLButtonElement} options.pauseBtn
 * @param {number} options.minMillis データ時系列の開始時刻(ms)
 */
export function createVideoModule(options) {
	const {
		bgVideo,
		videoTimeSetup,
		videoStartInput,
		videoStartApply,
		playBtn,
		pauseBtn,
		minMillis,
	} = options;

	let videoStartConfigured = false;
	let videoStartSeconds = 0;

	function applyStart() {
		if (!bgVideo || !videoStartInput) return;
		const raw = videoStartInput.value;
		const sec = parseTimeToSeconds(raw);
		if (Number.isNaN(sec) || sec < 0) {
			alert("時間は mm:ss または 秒数 で入力してください。");
			return;
		}
		try {
			videoStartSeconds = sec;
			const seek = () => {
				// duration が取得できている場合は範囲内にクランプ
				let target = videoStartSeconds;
				if (Number.isFinite(bgVideo.duration) && bgVideo.duration > 0) {
					const maxSeek = Math.max(0, bgVideo.duration - 0.1);
					target = Math.min(target, maxSeek);
				}
				bgVideo.currentTime = target;
				bgVideo.pause();
				videoStartConfigured = true;
				if (playBtn) playBtn.disabled = false;
				if (pauseBtn) pauseBtn.disabled = true;
				if (videoTimeSetup) {
					videoTimeSetup.style.display = "none";
				}
			};

			if (bgVideo.readyState >= 1) {
				seek();
			} else {
				bgVideo.addEventListener(
					"loadedmetadata",
					() => {
						seek();
					},
					{ once: true }
				);
				bgVideo.load();
			}
		} catch (e) {
			console.warn("動画シークに失敗しました", e);
		}
	}

	function syncToTimestamp(ts) {
		if (!bgVideo || !videoStartConfigured || !ts) return;
		try {
			const elapsedFromStartSec = (ts.getTime() - minMillis) / 1000;
			let target = videoStartSeconds + elapsedFromStartSec;
			if (Number.isFinite(bgVideo.duration) && bgVideo.duration > 0) {
				const maxSeek = Math.max(0, bgVideo.duration - 0.1);
				target = Math.min(Math.max(0, target), maxSeek);
			}
			bgVideo.currentTime = target;
		} catch (e) {
			console.warn("動画シーク同期に失敗しました", e);
		}
	}

	async function play() {
		if (!bgVideo) return;
		try {
			bgVideo.muted = true;
			await bgVideo.play();
		} catch (e) {
			console.warn("背景動画の再生に失敗しました", e);
		}
	}

	function pause() {
		if (bgVideo && !bgVideo.paused) {
			bgVideo.pause();
		}
	}

	function isConfigured() {
		return videoStartConfigured;
	}

	// 入力UIのイベントをここで束ねる
	if (videoStartApply) {
		videoStartApply.addEventListener("click", applyStart);
	}
	if (videoStartInput) {
		videoStartInput.addEventListener("keydown", (ev) => {
			if (ev.key === "Enter") {
				applyStart();
			}
		});
	}

	return { applyStart, syncToTimestamp, play, pause, isConfigured };
}
