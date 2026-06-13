import Anthropic from "@anthropic-ai/sdk";
import { Location, AnalysisResult, RoadAnalysisResponse, TokenUsage } from "./types";
import { createRoadWidthAnalysisPrompt, MODEL } from "./prompts";

// Claude Sonnet 4 料金 (USD per 1M tokens)
const PRICE_INPUT_PER_1M = 3.0;
const PRICE_OUTPUT_PER_1M = 15.0;

// 為替レート (USD -> JPY)
const USD_TO_JPY = 150;

// トークン使用量から金額を計算
function calculateTokenUsage(inputTokens: number, outputTokens: number): TokenUsage {
  const inputCostUsd = (inputTokens / 1_000_000) * PRICE_INPUT_PER_1M;
  const outputCostUsd = (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_1M;
  const costUsd = inputCostUsd + outputCostUsd;
  const costJpy = costUsd * USD_TO_JPY;

  return {
    inputTokens,
    outputTokens,
    costUsd: Math.round(costUsd * 1_000_000) / 1_000_000, // 小数6桁
    costJpy: Math.round(costJpy * 100) / 100, // 小数2桁
  };
}

// JSONテキストを抽出してパースする
function parseJsonResponse(text: string): RoadAnalysisResponse {
  // コードブロック内のJSONを抽出（```json ... ``` または ``` ... ```）
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();

  try {
    return JSON.parse(jsonText) as RoadAnalysisResponse;
  } catch (error) {
    throw new Error(`JSON parse error: ${error instanceof Error ? error.message : error}\nResponse: ${text}`);
  }
}

// Claude Sonnetで道幅を分析
export async function analyzeRoadWidth(
  client: Anthropic,
  imageBase64: string,
  location: Location
): Promise<AnalysisResult> {
  const startTime = performance.now();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
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
            text: createRoadWidthAnalysisPrompt(location),
          },
        ],
      },
    ],
  });

  const endTime = performance.now();
  const processingTimeMs = Math.round(endTime - startTime);

  // トークン使用量を計算
  const tokenUsage = calculateTokenUsage(
    response.usage.input_tokens,
    response.usage.output_tokens
  );

  // レスポンスからテキストを抽出
  const textContent = response.content.find((block) => block.type === "text");
  const analysisText = textContent && textContent.type === "text" ? textContent.text : "";

  // JSONをパース
  const analysis = parseJsonResponse(analysisText);

  return {
    location,
    analysis,
    processingTimeMs,
    tokenUsage,
  };
}
