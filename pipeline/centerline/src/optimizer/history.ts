// 履歴JSON保存

import * as fs from "fs";
import * as path from "path";
import { OptimizationHistory, OptimizationIteration, OptimizationConfig, SampleSet } from "./types";

const OUTPUT_DIR = path.join(__dirname, "output");

/**
 * 新しい最適化履歴を作成
 */
export function createOptimizationHistory(
  initialPrompt: string,
  sampleSet: SampleSet,
  config: OptimizationConfig
): OptimizationHistory {
  return {
    startedAt: new Date().toISOString(),
    initialPrompt,
    initialF1Score: 0,
    iterations: [],
    sampleSet,
    config,
  };
}

/**
 * イテレーション結果を追加
 */
export function addIteration(
  history: OptimizationHistory,
  iteration: OptimizationIteration
): void {
  history.iterations.push(iteration);

  // 初回の場合はinitialF1Scoreを設定
  if (iteration.iteration === 0) {
    history.initialF1Score = iteration.evaluation.metrics.f1Score;
  }
}

/**
 * 最適化完了を記録
 */
export function completeOptimization(
  history: OptimizationHistory,
  finalPrompt: string,
  finalF1Score: number
): void {
  history.completedAt = new Date().toISOString();
  history.finalPrompt = finalPrompt;
  history.finalF1Score = finalF1Score;
}

/**
 * 履歴をJSONファイルに保存
 */
export function saveHistory(history: OptimizationHistory): string {
  ensureOutputDir();

  const timestamp = history.startedAt.replace(/[:.]/g, "-");
  const fileName = `optimization_history_${timestamp}.json`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  // 最新版を常に同じ名前でも保存
  const latestPath = path.join(OUTPUT_DIR, "optimization_history.json");

  fs.writeFileSync(filePath, JSON.stringify(history, null, 2), "utf-8");
  fs.writeFileSync(latestPath, JSON.stringify(history, null, 2), "utf-8");

  console.log(`履歴を保存: ${filePath}`);

  return filePath;
}

/**
 * 履歴を読み込み
 */
export function loadHistory(filePath: string): OptimizationHistory {
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as OptimizationHistory;
}

/**
 * 最新の履歴を読み込み
 */
export function loadLatestHistory(): OptimizationHistory | null {
  const latestPath = path.join(OUTPUT_DIR, "optimization_history.json");

  if (!fs.existsSync(latestPath)) {
    return null;
  }

  return loadHistory(latestPath);
}

/**
 * 最適化サマリーを表示
 */
export function printOptimizationSummary(history: OptimizationHistory): void {
  console.log("\n========== 最適化サマリー ==========\n");
  console.log(`開始: ${history.startedAt}`);
  if (history.completedAt) {
    console.log(`完了: ${history.completedAt}`);
  }
  console.log(`\nサンプル数: ${history.sampleSet.samples.length}`);
  console.log(`  - true: ${history.sampleSet.trueCount}件`);
  console.log(`  - false: ${history.sampleSet.falseCount}件`);

  console.log(`\n初期F1スコア: ${(history.initialF1Score * 100).toFixed(1)}%`);
  if (history.finalF1Score !== undefined) {
    console.log(`最終F1スコア: ${(history.finalF1Score * 100).toFixed(1)}%`);
    const improvement = history.finalF1Score - history.initialF1Score;
    console.log(`改善幅: ${improvement >= 0 ? "+" : ""}${(improvement * 100).toFixed(1)}%`);
  }

  console.log(`\nイテレーション数: ${history.iterations.length}`);

  // 各イテレーションのサマリー
  for (const iter of history.iterations) {
    const f1 = iter.evaluation.metrics.f1Score;
    const improved = iter.improved ? "[改善]" : "";
    console.log(`  #${iter.iteration}: F1=${(f1 * 100).toFixed(1)}% ${improved}`);
  }

  // 総コストを計算
  let totalCost = 0;
  for (const iter of history.iterations) {
    totalCost += iter.evaluation.totalCostUsd;
    if (iter.candidateEvaluations) {
      for (const eval_ of iter.candidateEvaluations) {
        totalCost += eval_.totalCostUsd;
      }
    }
  }
  console.log(`\n総コスト: $${totalCost.toFixed(4)} (~¥${Math.round(totalCost * 150)})`);

  if (history.finalPrompt) {
    console.log(`\n========== 最終プロンプト ==========\n`);
    console.log(history.finalPrompt);
  }
}

// ヘルパー関数
function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}
