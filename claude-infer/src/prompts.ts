import { Location } from "./types";

const DEBUG = false;

export const MODEL = "claude-sonnet-4-5-20250929";
// export const MODEL = "claude-opus-4-5-20251101";
// export const MODEL = "claude-haiku-4-5-20251001";

// 道幅分析用プロンプトを生成
export function createRoadWidthAnalysisPrompt(location: Location): string {
  return DEBUG ? promptJp : promptEn;
}

const promptEn = `Estimate Japanese road characteristics from Google Street View images.

IMPORTANT: For center_line detection, consider both visible markings and road design:
- Check for faint traces or discoloration of white/yellow paint near the center
- Check for asphalt repair patches in the center area (may be covering old center lines)

When estimating lane width, consider the following:
- First estimate the total paved width using reference objects (guardrail 0.35m, vehicle 1.7m, etc.)

**Tunnel image characteristics and detection method:**
- Tunnel images are characterized by pinkish color tone and coarse noise

Respond in JSON format with the following fields:

lanes: Number of lanes (integer)
lane_width: Width of one lane (meters)
center_line: Presence of center line (true/false)
shoulder_left: Width of left shoulder in direction of travel (meters, null if none)
shoulder_right: Width of right shoulder in image (meters, null if none)
guardrail_left: Presence of guardrail on left side of image (true/false)
guardrail_right: Presence of guardrail on right side of image (true/false)
is_tunnel: Whether inside a tunnel (true/false)

Estimate scale using these reference values: guardrail (0.35m), solid center line (0.2m), double solid center line (0.15m), dashed center line (0.15m), vehicle width (1.7m), tunnel wall clearance (0.25-0.75m), etc.
Values to one decimal place. Per Japanese traffic law, vehicles drive on the left. Estimation only, no explanation needed.`

const promptJp = `Google Street Viewの画像から日本の道路特性を推定してください。
重要：中央線（center_line）の判定では、視認可能な標示と道路設計の両方を考慮すること：
中央線付近の白/黄色の塗装の薄い痕跡や変色を確認
中央部のアスファルト補修跡を確認（古い中央線を覆っている可能性）

車線の幅を推測する際は以下を考慮すること:
まず参照物（ガードレール0.35m、車両1.7m等）を使用して舗装部分の総幅を推定

**トンネル内画像の特徴と判定方法：**
- トンネル内の画像は、ピンク色がかった色調と粗いノイズが特徴的

以下のフィールドでJSON形式で回答してください：

lanes: 車線数（整数）
lane_width: 1車線の幅（メートル）
center_line: 中央線の有無（true/false）
shoulder_left: 進行方向左側の路肩幅（メートル、なければnull）
shoulder_right: 画像右側の路肩幅（メートル、なければnull）
guardrail_left: 画像左側のガードレールの有無（true/false）
guardrail_right: 画像右側のガードレールの有無（true/false）
is_tunnel: トンネル内かどうか（true/false）

以下の参照値でスケールを推定：ガードレール（0.35m）、実線中央線（0.2m）、二重実線中央線（0.15m）、破線中央線（0.15m）、車両幅（1.7m）、トンネル壁側の余白（0.25-0.75m）等。
値は小数点第1位まで。日本の道路交通法に従い、車両は左側通行。推定のみ、説明不要。`;
