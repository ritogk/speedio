// 共通ユーティリティモジュール

export function showError(message) {
	const el = document.getElementById("error");
	if (!el) return;
	el.textContent = message;
	el.style.display = "block";
}

export function formatTimeLabel(date) {
	if (!date) return "--:--:--";
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	const hh = String(date.getHours()).padStart(2, "0");
	const mm = String(date.getMinutes()).padStart(2, "0");
	const ss = String(date.getSeconds()).padStart(2, "0");
	return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

export function parseTimeToSeconds(input) {
	if (!input) return NaN;
	const trimmed = input.trim();
	if (!trimmed) return NaN;

	// mm:ss or hh:mm:ss 形式
	if (trimmed.includes(":")) {
		const parts = trimmed.split(":").map((p) => Number(p));
		if (parts.some((n) => Number.isNaN(n))) return NaN;
		let seconds = 0;
		if (parts.length === 2) {
			const [m, s] = parts;
			seconds = m * 60 + s;
		} else if (parts.length === 3) {
			const [h, m, s] = parts;
			seconds = h * 3600 + m * 60 + s;
		} else {
			return NaN;
		}
		return seconds;
	}

	// 生の秒数
	const asNumber = Number(trimmed);
	return Number.isNaN(asNumber) ? NaN : asNumber;
}

export async function loadJson(url) {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`${url} の読み込みに失敗しました (${res.status})`);
	}
	return res.json();
}
