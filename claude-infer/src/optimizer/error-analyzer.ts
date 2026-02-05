// FP/FNパターン分析

import Anthropic from "@anthropic-ai/sdk";
import { SampleEvaluation, ErrorAnalysis } from "./types";
import { fetchHighResStreetViewImage } from "../panorama";
import { MODEL } from "../prompts";
import { getNextPointForSample } from "./geometry-lookup";

/**
 * エラーケースを分析してパターンを抽出
 */
export async function analyzeErrors(
  anthropic: Anthropic,
  googleMapsApiKey: string,
  evaluations: SampleEvaluation[],
  currentPrompt: string
): Promise<ErrorAnalysis> {
  // FPとFNを抽出
  const fpCases = evaluations.filter((e) => e.errorType === "FP");
  const fnCases = evaluations.filter((e) => e.errorType === "FN");

  console.log(`エラー分析: FP=${fpCases.length}件, FN=${fnCases.length}件`);

  // 分析用に最大3件ずつ選択
  const fpSamples = fpCases.slice(0, 3);
  const fnSamples = fnCases.slice(0, 3);

  // 画像付きでエラーパターンを分析
  const fpPatterns = await analyzeErrorCases(anthropic, googleMapsApiKey, fpSamples, "FP");
  const fnPatterns = await analyzeErrorCases(anthropic, googleMapsApiKey, fnSamples, "FN");

  // サマリーを生成
  const summary = generateErrorSummary(fpCases.length, fnCases.length, fpPatterns, fnPatterns);

  return {
    fpPatterns,
    fnPatterns,
    summary,
  };
}

/**
 * エラーケースの画像を取得してパターンを分析
 */
async function analyzeErrorCases(
  anthropic: Anthropic,
  googleMapsApiKey: string,
  cases: SampleEvaluation[],
  errorType: "FP" | "FN"
): Promise<string[]> {
  if (cases.length === 0) {
    return [];
  }

  // 画像を取得
  const images: { lat: number; lng: number; base64: string }[] = [];

  for (const c of cases) {
    try {
      const nextPoint = getNextPointForSample(c.sample.lat, c.sample.lng);
      if (!nextPoint) continue;

      const imageBase64 = await fetchHighResStreetViewImage(
        c.sample.lat,
        c.sample.lng,
        googleMapsApiKey,
        nextPoint.lat,
        nextPoint.lng,
        1280,
        960,
        3
      );
      images.push({ lat: c.sample.lat, lng: c.sample.lng, base64: imageBase64 });
    } catch (error) {
      console.warn(`  画像取得エラー: (${c.sample.lat}, ${c.sample.lng})`);
    }
  }

  if (images.length === 0) {
    return [];
  }

  // Claudeにパターン分析を依頼
  const errorDescription = errorType === "FP"
    ? "実際は中央線なしだが、AIがありと誤判定したケース"
    : "実際は中央線ありだが、AIがなしと誤判定したケース";

  const analysisPrompt = `以下の${images.length}枚の画像は、日本の道路のStreet View画像です。

これらは「${errorDescription}」です。

これらの画像に共通するパターンや特徴を分析し、なぜAIが誤判定したのか考えられる理由を3つ以内で挙げてください。

回答は以下のJSON形式で：
{
  "patterns": [
    "パターン1の説明",
    "パターン2の説明"
  ]
}`;

  try {
    const content: Anthropic.Messages.ContentBlockParam[] = images.map((img) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/jpeg" as const,
        data: img.base64,
      },
    }));
    content.push({
      type: "text" as const,
      text: analysisPrompt,
    });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0,
      messages: [{ role: "user", content }],
    });

    const textContent = response.content.find((block) => block.type === "text");
    const responseText = textContent && textContent.type === "text" ? textContent.text : "";

    // JSONをパース
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = codeBlockMatch ? codeBlockMatch[1].trim() : responseText.trim();

    try {
      const parsed = JSON.parse(jsonText) as { patterns: string[] };
      return parsed.patterns || [];
    } catch {
      // パースに失敗した場合、テキストをそのまま返す
      return [responseText.substring(0, 200)];
    }
  } catch (error) {
    console.error(`  エラーパターン分析に失敗:`, error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * エラーサマリーを生成
 */
function generateErrorSummary(
  fpCount: number,
  fnCount: number,
  fpPatterns: string[],
  fnPatterns: string[]
): string {
  const lines: string[] = [];

  lines.push(`エラー総数: FP=${fpCount}, FN=${fnCount}`);

  if (fpPatterns.length > 0) {
    lines.push(`\nFalse Positive パターン:`);
    fpPatterns.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
  }

  if (fnPatterns.length > 0) {
    lines.push(`\nFalse Negative パターン:`);
    fnPatterns.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
  }

  return lines.join("\n");
}
