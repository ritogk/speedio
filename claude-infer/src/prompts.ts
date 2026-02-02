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
Important: For center_line determination, consider visible markings:

Check for faint traces or discoloration of white/yellow paint near the center
Check for asphalt repair marks in the center area (may be covering old center lines)

**Characteristics and determination method for tunnel images:**
- Images inside tunnels are characterized by pinkish color tone and coarse noise

Respond in JSON format with the following fields:

lanes: Number of lanes (integer)
lane_width: Width of one lane (meters)
center_line: Presence of center line (true/false)
shoulder_left: Width of shoulder on the left side in direction of travel (meters, null if none)
shoulder_right: Width of shoulder on the right side of image (meters, null if none)
guardrail_left: Presence of guardrail on left side of image (true/false)
guardrail_right: Presence of guardrail on right side of image (true/false)
is_tunnel: Whether inside a tunnel (true/false)

Estimate scale using the following reference values: guardrail (0.35m), solid center line (0.2m), double solid center line (0.15m), dashed center line (0.15m), vehicle width (1.7m), margin on tunnel wall side (0.25-0.75m), etc.
Values to one decimal place. Following Japanese Road Traffic Act, vehicles drive on the left side. Estimation only, no explanation needed.`

const promptJp = `Google Street Viewの画像から日本の道路特性を推定してください。
重要：中央線（center_line）の判定では、視認可能な標示を考慮すること：

中央線付近の白/黄色の塗装の薄い痕跡や変色を確認
中央部のアスファルト補修跡を確認（古い中央線を覆っている可能性）

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
