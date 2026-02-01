import { Location } from "./types";

const DEBUG = false;

// 道幅分析用プロンプトを生成
export function createRoadWidthAnalysisPrompt(location: Location): string {
  return DEBUG ? promptJp : promptEn;
}

const promptEn = `Estimate Japanese road features from a Google Street View image.

Respond in JSON format with the following fields:
- lanes: Number of lanes (integer)
- lane_width: Width of one lane (meters)
- center_line: Presence of center line (true/false)
- shoulder_left: Width of left shoulder in the direction of travel (meters, null if none)
- shoulder_right: Width of right shoulder in the image (meters, null if none)
- guardrail_left: Presence of guardrail on the left side of the image (true/false)
- guardrail_right: Presence of guardrail on the right side of the image (true/false)

Estimate scale using the following references: guardrail barrier (0.35m), single solid center line (0.2m), double solid center line (0.15m), single dashed center line (0.15m), vehicle width (1.7m), etc.
Values to one decimal place. Per Japanese Road Traffic Law, vehicles drive on the left. Estimation only, no explanation needed.`

const promptJp = `Google Street View画像から日本の道路特徴を推定してください。

以下の項目をJSON形式で回答：
- lanes: 車線数（整数）
- lane_width: 1車線の幅（メートル）
- center_line: センターライン有無（true/false）
- shoulder_left: 左側の路肩幅（メートル、なければnull）
- shoulder_right: 右側の路肩幅（メートル、なければnull）
- guardrail_left: 左側のガードレール有無（true/false）
- guardrail_right: 右側のガードレール有無（true/false）

ガードレールの防護柵(0.35m)、センターライン実線1本(0.2m)、センターライン実線2本(0.15m)、センターライン破線1本(0.15m)、車両(1.7m幅)等を基準にスケールを推定。
数値は小数1桁。推定のみ、説明不要。`;
