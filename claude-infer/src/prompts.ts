import { Location } from "./types";

const DEBUG = false;

export const MODEL = "claude-sonnet-4-5-20250929";
// export const MODEL = "claude-opus-4-5-20251101";
// export const MODEL = "claude-haiku-4-5-20251001";

// 道幅分析用プロンプトを生成
export function createRoadWidthAnalysisPrompt(location: Location): string {
  return DEBUG ? promptJp : promptEn;
}

const promptEn = `Estimate Japanese road features from a Google Street View image.
Important: For center_line judgment, consider both visible markings AND road design:
1. First estimate total paved width using reference objects (guardrail 0.35m, vehicle 1.7m, etc.)
2. If total width is 5.0m or more, center_line is likely true even if paint is faded/invisible
3. Check for faint traces of white/yellow paint or discoloration along the centerline
4. Look for road symmetry - similar shoulder widths on both sides suggests 2-lane design
5. Check for asphalt patches in center that may have covered old center lines
6. If center_line appears designed to exist but is faded: set center_line to true
Respond in JSON format with the following fields:
- lanes: integer number of lanes (if center_line is false, set to 1)
- lane_width: Width of one lane (meters)
- center_line: Presence of center line (true/false)
- shoulder_left: Width of left shoulder in the direction of travel (meters, null if none)
- shoulder_right: Width of right shoulder in the image (meters, null if none)
- guardrail_left: Presence of guardrail on the left side of the image (true/false)
- guardrail_right: Presence of guardrail on the right side of the image (true/false)
- can_pass_oncoming_without_slowing: can pass oncoming vehicles without slowing down (true/false)
Estimate scale using the following references: guardrail barrier (0.35m), single solid center line (0.2m), double solid center line (0.15m), single dashed center line (0.15m), vehicle width (1.7m), etc.
Values to one decimal place. Per Japanese Road Traffic Law, vehicles drive on the left. Estimation only, no explanation needed.`

const promptJp = `Google Street Viewの画像から日本の道路特性を推定してください。
重要：中央線（center_line）の判定では、視認可能な標示と道路設計の両方を考慮すること：

まず参照物（ガードレール0.35m、車両1.7m等）を使用して舗装部分の総幅を推定
総幅が5.0m以上の場合、塗装が薄れている/見えなくても中央線はtrueの可能性が高い
中央線付近の白/黄色の塗装の薄い痕跡や変色を確認
道路の対称性を確認 - 両側の路肩幅が似ていれば2車線設計を示唆
中央部のアスファルト補修跡を確認（古い中央線を覆っている可能性）
中央線が設計上存在するはずだが薄れている場合：center_lineをtrueに設定

以下のフィールドでJSON形式で回答してください：

lanes: 車線数（整数）（center_lineがfalseの場合は1に設定）
lane_width: 1車線の幅（メートル）
center_line: 中央線の有無（true/false）
shoulder_left: 進行方向左側の路肩幅（メートル、なければnull）
shoulder_right: 画像右側の路肩幅（メートル、なければnull）
guardrail_left: 画像左側のガードレールの有無（true/false）
guardrail_right: 画像右側のガードレールの有無（true/false）
can_pass_oncoming_without_slowing: 対向車と減速せずにすれ違い可能か（true/false）

以下の参照値でスケールを推定：ガードレール（0.35m）、実線中央線（0.2m）、二重実線中央線（0.15m）、破線中央線（0.15m）、車両幅（1.7m）等。
値は小数点第1位まで。日本の道路交通法に従い、車両は左側通行。推定のみ、説明不要。`;
