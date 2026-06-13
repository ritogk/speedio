// 精度評価（Accuracy, Precision, Recall, F1）

import Anthropic from "@anthropic-ai/sdk";
import { Sample, SampleEvaluation, EvaluationResult, Metrics } from "./types";
import { fetchHighResStreetViewImage } from "../panorama";
import { MODEL } from "../prompts";
import { getNextPointForSample } from "./geometry-lookup";

// Claude Sonnet 4 料金 (USD per 1M tokens)
const PRICE_INPUT_PER_1M = 3.0;
const PRICE_OUTPUT_PER_1M = 15.0;

interface CenterLineResponse {
  center_line: boolean;
}

/**
 * 指定されたプロンプトでサンプルセットを評価
 */
export async function evaluatePrompt(
  anthropic: Anthropic,
  googleMapsApiKey: string,
  samples: Sample[],
  prompt: string,
  batchSize: number = 8
): Promise<EvaluationResult> {
  const evaluations: SampleEvaluation[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  console.log(`評価開始: ${samples.length}件のサンプル`);

  // バッチ処理
  for (let i = 0; i < samples.length; i += batchSize) {
    const batch = samples.slice(i, Math.min(i + batchSize, samples.length));
    console.log(`  バッチ ${Math.floor(i / batchSize) + 1}/${Math.ceil(samples.length / batchSize)}: ${batch.length}件`);

    const batchPromises = batch.map((sample) =>
      evaluateSingleSample(anthropic, googleMapsApiKey, sample, prompt)
    );

    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      if (result) {
        evaluations.push(result.evaluation);
        totalInputTokens += result.inputTokens;
        totalOutputTokens += result.outputTokens;
      }
    }
  }

  // メトリクス計算
  const metrics = calculateMetrics(evaluations);

  // コスト計算
  const inputCostUsd = (totalInputTokens / 1_000_000) * PRICE_INPUT_PER_1M;
  const outputCostUsd = (totalOutputTokens / 1_000_000) * PRICE_OUTPUT_PER_1M;
  const totalCostUsd = inputCostUsd + outputCostUsd;

  console.log(`評価完了: F1=${metrics.f1Score.toFixed(3)}, コスト=$${totalCostUsd.toFixed(4)}`);

  return {
    prompt,
    samples: evaluations,
    metrics,
    totalCostUsd,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * 単一サンプルを評価
 */
async function evaluateSingleSample(
  anthropic: Anthropic,
  googleMapsApiKey: string,
  sample: Sample,
  prompt: string
): Promise<{ evaluation: SampleEvaluation; inputTokens: number; outputTokens: number } | null> {
  try {
    // 次の地点を取得（進行方向を決定するため）
    const nextPoint = getNextPointForSample(sample.lat, sample.lng);
    if (!nextPoint) {
      console.warn(`  スキップ: (${sample.lat}, ${sample.lng}) の次地点が見つかりません`);
      return null;
    }

    // 画像を取得
    const imageBase64 = await fetchHighResStreetViewImage(
      sample.lat,
      sample.lng,
      googleMapsApiKey,
      nextPoint.lat,
      nextPoint.lng,
      1280,
      960,
      3
    );

    // Claude APIで推論
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 256,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    // レスポンスをパース
    const textContent = response.content.find((block) => block.type === "text");
    const responseText = textContent && textContent.type === "text" ? textContent.text : "";
    const predicted = parseCenterLineResponse(responseText);

    const correct = predicted === sample.hasCenterLine;
    let errorType: "FP" | "FN" | undefined;
    if (!correct) {
      errorType = predicted ? "FP" : "FN";
    }

    return {
      evaluation: {
        sample,
        predicted,
        correct,
        errorType,
      },
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch (error) {
    console.error(`  エラー: (${sample.lat}, ${sample.lng}) の評価に失敗:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Claude応答からcenter_lineの値をパース
 */
function parseCenterLineResponse(responseText: string): boolean {
  // JSONを抽出
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = codeBlockMatch ? codeBlockMatch[1].trim() : responseText.trim();

  try {
    const parsed = JSON.parse(jsonText) as CenterLineResponse;
    return parsed.center_line === true;
  } catch {
    // JSONパースに失敗した場合、テキストから直接判定
    const lowerText = responseText.toLowerCase();
    if (lowerText.includes('"center_line": true') || lowerText.includes('"center_line":true')) {
      return true;
    }
    if (lowerText.includes('"center_line": false') || lowerText.includes('"center_line":false')) {
      return false;
    }
    // デフォルトはfalse
    console.warn(`  警告: center_lineのパースに失敗: ${responseText.substring(0, 100)}`);
    return false;
  }
}

/**
 * 評価結果からメトリクスを計算
 */
function calculateMetrics(evaluations: SampleEvaluation[]): Metrics {
  let truePositives = 0;
  let trueNegatives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  for (const evaluation of evaluations) {
    if (evaluation.sample.hasCenterLine && evaluation.predicted) {
      truePositives++;
    } else if (!evaluation.sample.hasCenterLine && !evaluation.predicted) {
      trueNegatives++;
    } else if (!evaluation.sample.hasCenterLine && evaluation.predicted) {
      falsePositives++;
    } else if (evaluation.sample.hasCenterLine && !evaluation.predicted) {
      falseNegatives++;
    }
  }

  const total = evaluations.length;
  const accuracy = total > 0 ? (truePositives + trueNegatives) / total : 0;

  const precisionDenom = truePositives + falsePositives;
  const precision = precisionDenom > 0 ? truePositives / precisionDenom : 0;

  const recallDenom = truePositives + falseNegatives;
  const recall = recallDenom > 0 ? truePositives / recallDenom : 0;

  const f1Denom = precision + recall;
  const f1Score = f1Denom > 0 ? (2 * precision * recall) / f1Denom : 0;

  return {
    accuracy,
    precision,
    recall,
    f1Score,
    truePositives,
    trueNegatives,
    falsePositives,
    falseNegatives,
  };
}
