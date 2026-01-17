// キーボードショートカット用モジュール

// 調整頻度の高いキー設定
const TOGGLE_UI_KEYS = ["z", "Z"];

/**
 * z / Z キーでシークUI・再生/一時停止エリア・ステータスバーの表示/非表示を切り替える。
 * @param {Object} opts
 * @param {HTMLElement|null} opts.videoTimeSetup
 * @param {HTMLElement|null} opts.controls
 * @param {HTMLElement|null} opts.statusBar
 * @param {HTMLInputElement|null} opts.videoStartInput
 */
export function registerZKeyToggle({ videoTimeSetup, controls, statusBar, videoStartInput }) {
	if (!videoTimeSetup || !controls) return;

	window.addEventListener("keydown", (ev) => {
		if (TOGGLE_UI_KEYS.includes(ev.key)) {
			const hidden =
				videoTimeSetup.style.display === "none" ||
				controls.style.display === "none" ||
				(statusBar && statusBar.style.display === "none");
			if (hidden) {
				videoTimeSetup.style.display = "inline-flex";
				controls.style.display = "flex";
				if (statusBar) {
					statusBar.style.display = "flex";
				}
				if (videoStartInput) {
					try {
						videoStartInput.focus();
						videoStartInput.select();
					} catch (e) {
						console.warn("開始位置入力へのフォーカスに失敗しました", e);
					}
				}
			} else {
				videoTimeSetup.style.display = "none";
				controls.style.display = "none";
				if (statusBar) {
					statusBar.style.display = "none";
				}
			}
		}
	});
}
