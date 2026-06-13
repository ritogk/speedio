// Claudeでプロンプト改善案生成

import Anthropic from "@anthropic-ai/sdk";
import { ErrorAnalysis, PromptCandidate, Metrics } from "./types";
import { MODEL } from "../prompts";

/**
 * エラー分析に基づいてプロンプト改善案を生成
 */
export async function generatePromptCandidates(
  anthropic: Anthropic,
  currentPrompt: string,
  metrics: Metrics,
  errorAnalysis: ErrorAnalysis,
  candidateCount: number
): Promise<PromptCandidate[]> {
  console.log(`プロンプト候補を${candidateCount}件生成中...`);

  const metaPrompt = `あなたはAIプロンプトエンジニアです。Google Street View画像から日本の道路の中央線（センターライン）を検出するプロンプトを改善してください。

## 現在のプロンプト
\`\`\`
${currentPrompt}
\`\`\`

## 現在の性能
- Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%
- Precision: ${(metrics.precision * 100).toFixed(1)}%
- Recall: ${(metrics.recall * 100).toFixed(1)}%
- F1 Score: ${(metrics.f1Score * 100).toFixed(1)}%
- True Positives: ${metrics.truePositives}
- True Negatives: ${metrics.trueNegatives}
- False Positives: ${metrics.falsePositives}
- False Negatives: ${metrics.falseNegatives}

## エラー分析結果
${errorAnalysis.summary}

## 改善の方向性
${metrics.falsePositives > metrics.falseNegatives
    ? "False Positiveが多いため、中央線と判定する条件をより厳格にする必要があります。"
    : "False Negativeが多いため、薄れた中央線や見えにくい中央線も検出できるようにする必要があります。"}

## 要件
1. ${candidateCount}つの異なる改善プロンプトを生成してください
2. 各プロンプトは完全に独立しており、そのまま使用可能であること
3. プロンプトの出力形式はJSONで、必ず "center_line": true/false を含むこと
4. 日本語のプロンプトと英語のプロンプトの両方を検討してください
5. エラーパターンに対処する具体的な指示を含めてください

## 回答形式
以下のJSON形式で回答してください：
{
  "candidates": [
    {
      "prompt": "改善プロンプト1の全文",
      "rationale": "この改善がなぜ効果的か"
    },
    {
      "prompt": "改善プロンプト2の全文",
      "rationale": "この改善がなぜ効果的か"
    },
    {
      "prompt": "改善プロンプト3の全文",
      "rationale": "この改善がなぜ効果的か"
    }
  ]
}`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.7, // 多様な候補を生成するため少し高めに
      messages: [{ role: "user", content: metaPrompt }],
    });

    const textContent = response.content.find((block) => block.type === "text");
    const responseText = textContent && textContent.type === "text" ? textContent.text : "";

    // JSONをパース
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = codeBlockMatch ? codeBlockMatch[1].trim() : responseText.trim();

    try {
      const parsed = JSON.parse(jsonText) as { candidates: PromptCandidate[] };
      const candidates = parsed.candidates.slice(0, candidateCount);

      console.log(`  ${candidates.length}件のプロンプト候補を生成`);
      candidates.forEach((c, i) => {
        console.log(`  候補${i + 1}: ${c.rationale.substring(0, 50)}...`);
      });

      return candidates;
    } catch (parseError) {
      console.error(`  プロンプト候補のパースに失敗:`, parseError);
      return [];
    }
  } catch (error) {
    console.error(`  プロンプト候補の生成に失敗:`, error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * 中央線検出に特化した基本プロンプトを取得
 */
export function getBaseCenterLinePrompt(): string {
  return `Analyze this Google Street View image of a Japanese road and determine if there is a center line.

IMPORTANT: A center line is a painted line that separates traffic traveling in opposite directions. Look for:
- Solid white or yellow line in the center of the road
- Dashed white or yellow line in the center of the road
- Faded or worn center line markings
- Evidence of repainted or covered center lines

DO NOT consider as center line:
- Edge lines (lines at the road edges)
- Lane markings within the same direction of traffic
- Crosswalk markings
- Other road markings that are not center lines

Respond in JSON format:
{
  "center_line": true or false,
  "confidence": "high", "medium", or "low",
  "reason": "brief explanation"
}

Note: Japanese vehicles drive on the left side. Per Japanese traffic law, center lines separate opposing traffic.`;
}
