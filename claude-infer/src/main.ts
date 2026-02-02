import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

import { AnalysisResult, AnalysisOutput, TokenUsage, TargetEntry } from "./types";
import { loadConfig } from "./config";
import { loadTargetEntries } from "./loader";
import { fetchStreetViewImage, getNextPointFromGeometry } from "./streetview";
import { analyzeRoadWidth } from "./analyzer";
import { saveResultsToDb, closeDb } from "./db";

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
  geometryList: [number, number][],
  config: { googleMapsApiKey: string },
  anthropic: Anthropic,
  totalCount: number
): Promise<{ index: number; result: AnalysisResult } | null> {
  console.log(`[${index + 1}/${totalCount}] (${location.lat}, ${location.lng}) を分析開始...`);

  try {
    const nextPoint = getNextPointFromGeometry(location.lat, location.lng, geometryList);
    if (!nextPoint) return null;

    const imageBase64 = await fetchStreetViewImage(
      index,
      location.lat,
      location.lng,
      config.googleMapsApiKey,
      nextPoint.lat,
      nextPoint.lng
    );
    console.log(`[${index + 1}/${totalCount}] (${location.lat}, ${location.lng}) 画像取得完了`);

    const result = await analyzeRoadWidth(anthropic, imageBase64, location);
    console.log(`[${index + 1}/${totalCount}] (${location.lat}, ${location.lng}) 分析完了`);
    return { index, result };
  } catch (error) {
    console.error(`エラー: [${index + 1}] (${location.lat}, ${location.lng}) の分析に失敗しました`);
    console.error(error instanceof Error ? error.message : error);
    return null;
  }
}

// 1つのエントリを処理する関数
async function processEntry(
  entryIndex: number,
  entry: TargetEntry,
  config: { googleMapsApiKey: string },
  anthropic: Anthropic,
  totalEntries: number
): Promise<AnalysisResult[]> {
  const { geometry_list, geometry_check_list } = entry;

  // geometry_check_listを座標オブジェクトに変換（先頭と末尾を除く）
  const locations = geometry_check_list
    .slice(1, geometry_check_list.length - 1)
    .map(([lat, lng]) => ({ lat, lng }));

  console.log(`\n[エントリ ${entryIndex + 1}/${totalEntries}] ${locations.length} 件を処理中...`);

  // 8件ずつ並列処理
  const BATCH_SIZE = 8;
  const allRawResults: ({ index: number; result: AnalysisResult } | null)[] = [];

  for (let batchStart = 0; batchStart < locations.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, locations.length);
    const batchLocations = locations.slice(batchStart, batchEnd);

    const batchPromises = batchLocations.map((location, i) =>
      analyzeLocation(batchStart + i, location, geometry_list, config, anthropic, locations.length)
    );

    const batchResults = await Promise.all(batchPromises);
    allRawResults.push(...batchResults);
  }

  return allRawResults
    .filter((r): r is { index: number; result: AnalysisResult } => r !== null)
    .sort((a, b) => a.index - b.index)
    .map((r) => r.result);
}

// メイン処理
async function main() {
  console.log("=== Street View 道幅分析ツール ===\n");

  // 設定を読み込み
  const config = loadConfig();

  // Anthropicクライアント初期化
  const anthropic = new Anthropic();

  // target.jsonを読み込み
  const entries = loadTargetEntries();
  console.log(`${entries.length} 件のエントリを読み込みました`);

  // 全エントリを処理
  const allResults: AnalysisResult[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entryResults = await processEntry(i, entries[i], config, anthropic, entries.length);
    allResults.push(...entryResults);

    // エントリごとにDBに保存
    if (entryResults.length > 0) {
      try {
        const dbCount = await saveResultsToDb(entryResults);
        console.log(`[エントリ ${i + 1}] DBに ${dbCount} 件保存`);
      } catch (error) {
        console.error(`[エントリ ${i + 1}] DBへの保存に失敗:`, error);
      }
    }
  }

  // サマリーを出力
  console.log("\n\n========== 分析結果サマリー ==========\n");
  console.log("| 座標 | 車線数 | 車幅 | センターライン | 対向車と減速せずすれ違える | 処理時間 |");
  console.log("|------|--------|--------|----------------|--------------------------|----------|");

  for (const result of allResults) {
    const lanes = result.analysis.lanes;
    const laneWidth = `${result.analysis.lane_width}m`;
    const centerLine = result.analysis.center_line ? "○" : "×";
    const canPassOnComingWithoutSlowing = result.analysis.can_pass_oncoming_without_slowing ? "○" : "×";
    console.log(`| (${result.location.lat}, ${result.location.lng}) | ${lanes} | ${laneWidth} | ${centerLine} | ${canPassOnComingWithoutSlowing} | ${result.processingTimeMs}ms |`);
  }

  // 合計金額を表示
  if (allResults.length > 0) {
    const total = calculateTotalTokenUsage(allResults);
    console.log("\n【合計トークン使用量】");
    console.log(`入力トークン: ${total.inputTokens.toLocaleString()}`);
    console.log(`出力トークン: ${total.outputTokens.toLocaleString()}`);
    console.log(`合計金額: ¥${total.costJpy.toLocaleString()} ($${total.costUsd})`);

    // JSONファイルに保存
    const outputPath = saveResultsToJson(allResults);
    console.log(`\n結果をJSONファイルに保存しました: ${outputPath}`);
  }

  // DB接続を閉じる
  await closeDb();

  console.log("\n分析完了");
}

// 実行
main().catch(console.error);
