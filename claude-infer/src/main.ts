import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

import { AnalysisResult, AnalysisOutput, TokenUsage } from "./types";
import { loadConfig } from "./config";
import { loadLocations } from "./loader";
import { fetchStreetViewImage, getNextPointFromGeometry } from "./streetview";
import { analyzeRoadWidth } from "./analyzer";

const OUTPUT_DIR = path.join(__dirname, "..", "output");

// 出力ディレクトリを作成
function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

// トークン使用量の合計を計算
function calculateTotalTokenUsage(results: AnalysisResult[]): TokenUsage {
  const total = results.reduce(
    (acc, r) => ({
      inputTokens: acc.inputTokens + r.tokenUsage.inputTokens,
      outputTokens: acc.outputTokens + r.tokenUsage.outputTokens,
      costUsd: acc.costUsd + r.tokenUsage.costUsd,
      costJpy: acc.costJpy + r.tokenUsage.costJpy,
    }),
    { inputTokens: 0, outputTokens: 0, costUsd: 0, costJpy: 0 }
  );

  return {
    inputTokens: total.inputTokens,
    outputTokens: total.outputTokens,
    costUsd: Math.round(total.costUsd * 1_000_000) / 1_000_000,
    costJpy: Math.round(total.costJpy * 100) / 100,
  };
}

// 結果をJSONファイルに保存
function saveResultsToJson(results: AnalysisResult[]): string {
  ensureOutputDir();

  const output: AnalysisOutput = {
    generatedAt: new Date().toISOString(),
    totalLocations: results.length,
    totalTokenUsage: calculateTotalTokenUsage(results),
    results,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `analysis_${timestamp}.json`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  fs.writeFileSync(filePath, JSON.stringify(output, null, 2), "utf-8");

  return filePath;
}

// 単一の位置を分析する関数
async function analyzeLocation(
  index: number,
  location: { lat: number; lng: number },
  config: { googleMapsApiKey: string },
  anthropic: Anthropic,
  totalCount: number
): Promise<{ index: number; result: AnalysisResult } | null> {
  console.log(`[${index + 1}/${totalCount}] (${location.lat}, ${location.lng}) を分析開始...`);

  try {
    const nextPoint = getNextPointFromGeometry(location.lat, location.lng);
    if (!nextPoint) return null;

    const imageBase64 = await fetchStreetViewImage(
      index,
      location.lat,
      location.lng,
      config.googleMapsApiKey,
      nextPoint.lat,
      nextPoint.lng
    );

    const result = await analyzeRoadWidth(anthropic, imageBase64, location);
    console.log(`[${index + 1}/${totalCount}] (${location.lat}, ${location.lng}) 分析完了`);
    return { index, result };
  } catch (error) {
    console.error(`エラー: [${index + 1}] (${location.lat}, ${location.lng}) の分析に失敗しました`);
    console.error(error instanceof Error ? error.message : error);
    return null;
  }
}

// メイン処理
async function main() {
  console.log("=== Street View 道幅分析ツール ===\n");

  // 設定を読み込み
  const config = loadConfig();

  // Anthropicクライアント初期化
  const anthropic = new Anthropic();

  // 位置情報を読み込み
  const locations = loadLocations();
  console.log(`${locations.length} 件の位置情報を読み込みました\n`);

  // 各位置について並列で分析
  const targetLocations = locations.slice(1, locations.length - 1);
  console.log(`${targetLocations.length} 件を並列処理中...\n`);

  const promises = targetLocations.map((location, i) =>
    analyzeLocation(i + 1, location, config, anthropic, locations.length)
  );

  const rawResults = await Promise.all(promises);

  // nullを除外し、index順にソート
  const results: AnalysisResult[] = rawResults
    .filter((r): r is { index: number; result: AnalysisResult } => r !== null)
    .sort((a, b) => a.index - b.index)
    .map((r) => r.result)

  // サマリーを出力
  console.log("\n\n========== 分析結果サマリー ==========\n");
  console.log("| 座標 | 車線数 | 車幅 | センターライン | 処理時間 |");
  console.log("|------|--------|--------|----------------|----------|");

  for (const result of results) {
    const lanes = result.analysis.lanes;
    const laneWidth = `${result.analysis.lane_width}m`;
    const centerLine = result.analysis.center_line ? "○" : "×";
    console.log(`| (${result.location.lat}, ${result.location.lng}) | ${lanes} | ${laneWidth} | ${centerLine} | ${result.processingTimeMs}ms |`);
  }

  // 合計金額を表示
  if (results.length > 0) {
    const total = calculateTotalTokenUsage(results);
    console.log("\n【合計トークン使用量】");
    console.log(`入力トークン: ${total.inputTokens.toLocaleString()}`);
    console.log(`出力トークン: ${total.outputTokens.toLocaleString()}`);
    console.log(`合計金額: ¥${total.costJpy.toLocaleString()} ($${total.costUsd})`);

    // JSONファイルに保存
    const outputPath = saveResultsToJson(results);
    console.log(`\n結果をJSONファイルに保存しました: ${outputPath}`);
  }

  console.log("\n分析完了");
}

// 実行
main().catch(console.error);
