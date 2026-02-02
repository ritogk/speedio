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
IMPORTANT: When determining center_line, consider both visible markings and road design:

First, estimate total pavement width using reference objects (guardrail 0.35m, vehicle 1.7m, etc.)
If total width is 5.0m or more, center_line is likely true even if paint is faded/invisible
Check for faint traces of white/yellow paint or discoloration near the center
Verify road symmetry - similar shoulder widths on both sides suggest 2-lane design
Check for asphalt repair patches in the center (may be covering old center lines)
If center line should exist by design but is faded: set center_line to true

**Tunnel Image Characteristics and Detection:**
- Tunnel images are characterized by pinkish color tone and coarse noise

Respond in JSON format with the following fields:

lanes: Number of lanes (integer) (set to 1 if center_line is false)
lane_width: Width of one lane (meters)
center_line: Presence of center line (true/false)
shoulder_left: Left shoulder width in direction of travel (meters, null if none)
shoulder_right: Right shoulder width in image (meters, null if none)
guardrail_left: Presence of guardrail on left side of image (true/false)
guardrail_right: Presence of guardrail on right side of image (true/false)
can_pass_oncoming_without_slowing: Can pass oncoming traffic without slowing (true/false)
is_tunnel: Whether inside a tunnel (true/false)
has_cats_eye: Presence of cat's eyes/road studs on the road (true/false)

Use these reference values for scale estimation: guardrail (0.35m), solid center line (0.2m), double solid center line (0.15m), dashed center line (0.15m), vehicle width (1.7m), tunnel wall margin (0.25-0.75m), etc.
Values to one decimal place. Following Japanese traffic laws, vehicles drive on the left side. Estimation only, no explanation required.`

const promptJp = `Google Street Viewの画像から日本の道路特性を推定してください。
重要：中央線（center_line）の判定では、視認可能な標示と道路設計の両方を考慮すること：

まず参照物（ガードレール0.35m、車両1.7m等）を使用して舗装部分の総幅を推定
総幅が5.0m以上の場合、塗装が薄れている/見えなくても中央線はtrueの可能性が高い
中央線付近の白/黄色の塗装の薄い痕跡や変色を確認
道路の対称性を確認 - 両側の路肩幅が似ていれば2車線設計を示唆
中央部のアスファルト補修跡を確認（古い中央線を覆っている可能性）
中央線が設計上存在するはずだが薄れている場合：center_lineをtrueに設定

**トンネル内画像の特徴と判定方法：**
- トンネル内の画像は、ピンク色がかった色調と粗いノイズが特徴的

以下のフィールドでJSON形式で回答してください：

lanes: 車線数（整数）（center_lineがfalseの場合は1に設定）
lane_width: 1車線の幅（メートル）
center_line: 中央線の有無（true/false）
shoulder_left: 進行方向左側の路肩幅（メートル、なければnull）
shoulder_right: 画像右側の路肩幅（メートル、なければnull）
guardrail_left: 画像左側のガードレールの有無（true/false）
guardrail_right: 画像右側のガードレールの有無（true/false）
can_pass_oncoming_without_slowing: 対向車と減速せずにすれ違い可能か（true/false）
is_tunnel: トンネル内かどうか（true/false）
has_cats_eye: キャッツアイ（道路鋲）の有無（true/false）

以下の参照値でスケールを推定：ガードレール（0.35m）、実線中央線（0.2m）、二重実線中央線（0.15m）、破線中央線（0.15m）、車両幅（1.7m）、トンネル壁側の余白（0.25-0.75m）等。
値は小数点第1位まで。日本の道路交通法に従い、車両は左側通行。推定のみ、説明不要。`;
