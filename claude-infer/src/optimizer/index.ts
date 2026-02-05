// メインの最適化ループ

import Anthropic from "@anthropic-ai/sdk";
import { loadConfig } from "../config";
import {
  OptimizationConfig,
  OptimizationIteration,
  OptimizationHistory,
  DEFAULT_CONFIG,
  EvaluationResult,
} from "./types";
import { createAndSaveSampleSet, getAvailableSampleCounts, closeSamplerDb } from "./sampler";
import { evaluatePrompt } from "./evaluator";
import { analyzeErrors } from "./error-analyzer";
import { generatePromptCandidates, getBaseCenterLinePrompt } from "./prompt-generator";
import {
  createOptimizationHistory,
  addIteration,
  completeOptimization,
  saveHistory,
  printOptimizationSummary,
  loadLatestHistory,
} from "./history";
import { setPrefCode } from "./geometry-lookup";

// コマンドライン引数をパース
interface ParsedArgs {
  config: Partial<OptimizationConfig>;
  prefCode: string | null;
  continueFromLast: boolean;
}

function parseArgs(): ParsedArgs {
  const config: Partial<OptimizationConfig> = {};
  let prefCode: string | null = null;
  let continueFromLast = false;
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const nextArg = argv[i + 1];

    if (arg === "--sample-size" && nextArg) {
      config.sampleSize = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--max-iterations" && nextArg) {
      config.maxIterations = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--candidates" && nextArg) {
      config.candidatesPerIteration = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--min-improvement" && nextArg) {
      config.minImprovement = parseFloat(nextArg);
      i++;
    } else if (arg === "--parallel" && nextArg) {
      config.parallelCandidates = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--batch-size" && nextArg) {
      config.batchSize = parseInt(nextArg, 10);
      i++;
    } else if (arg === "--pref" && nextArg) {
      prefCode = nextArg;
      i++;
    } else if (arg === "--continue") {
      continueFromLast = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return { config, prefCode, continueFromLast };
}

function printHelp(): void {
  console.log(`
中央線検出プロンプト最適化ツール

使用法:
  npx ts-node src/optimizer/index.ts [オプション]

オプション:
  --pref <code>          都道府県コード (例: 21=岐阜, 23=愛知)。省略時は全都道府県
  --sample-size <n>      テスト用サンプル数 (デフォルト: ${DEFAULT_CONFIG.sampleSize})
  --max-iterations <n>   最大繰り返し回数 (デフォルト: ${DEFAULT_CONFIG.maxIterations})
  --candidates <n>       1回あたりのプロンプト候補数 (デフォルト: ${DEFAULT_CONFIG.candidatesPerIteration})
  --min-improvement <n>  最小改善幅 (デフォルト: ${DEFAULT_CONFIG.minImprovement})
  --parallel <n>         候補プロンプトの同時評価数 (デフォルト: ${DEFAULT_CONFIG.parallelCandidates})
  --batch-size <n>       サンプル評価のバッチサイズ (デフォルト: ${DEFAULT_CONFIG.batchSize})
  --continue             前回の最終プロンプトから継続して最適化
  --help, -h             このヘルプを表示

例:
  # 岐阜県のみで小規模テスト
  npx ts-node src/optimizer/index.ts --pref 21 --sample-size 10 --max-iterations 1

  # 前回の結果から継続して最適化
  npx ts-node src/optimizer/index.ts --continue --max-iterations 3

  # 高速並列実行（APIレート制限に注意）
  npx ts-node src/optimizer/index.ts --pref 21 --parallel 5 --batch-size 15

  # 本番実行（全都道府県）
  npx ts-node src/optimizer/index.ts
`);
}

/**
 * 並列度制限付きでPromiseを実行
 */
async function parallelLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];
      results[index] = await fn(item, index);
    }
  }

  // limit個のワーカーを並列実行
  const workers = Array(Math.min(limit, items.length))
    .fill(null)
    .map(() => worker());
  await Promise.all(workers);

  return results;
}

/**
 * メイン最適化ループ
 */
async function runOptimization(config: OptimizationConfig, continueFromLast: boolean): Promise<void> {
  console.log("=== 中央線検出プロンプト最適化 ===\n");
  console.log(`設定:`);
  console.log(`  サンプルサイズ: ${config.sampleSize}`);
  console.log(`  最大イテレーション: ${config.maxIterations}`);
  console.log(`  候補数/イテレーション: ${config.candidatesPerIteration}`);
  console.log(`  最小改善幅: ${config.minImprovement}`);
  console.log(`  並列候補評価数: ${config.parallelCandidates}`);
  console.log(`  バッチサイズ: ${config.batchSize}`);
  console.log(`  継続モード: ${continueFromLast ? "有効" : "無効"}`);
  console.log();

  // 設定を読み込み
  const appConfig = loadConfig();
  const anthropic = new Anthropic();

  // 利用可能なサンプル数を確認（ジオメトリルックアップも同時に構築される）
  const available = await getAvailableSampleCounts();
  console.log(`利用可能なサンプル: true=${available.trueCount}, false=${available.falseCount}`);

  if (available.trueCount < config.sampleSize / 2 || available.falseCount < config.sampleSize / 2) {
    console.error(`エラー: サンプルが不足しています。各クラス最低${config.sampleSize / 2}件必要です。`);
    process.exit(1);
  }

  // サンプルセットを作成
  console.log(`\nサンプルセットを作成中...`);
  const sampleSet = await createAndSaveSampleSet(config.sampleSize);

  // 初期プロンプトを取得（継続モードの場合は前回の最終プロンプトを使用）
  let currentPrompt: string;
  if (continueFromLast) {
    const lastHistory = loadLatestHistory();
    if (lastHistory && lastHistory.finalPrompt) {
      currentPrompt = lastHistory.finalPrompt;
      console.log(`\n前回の最終プロンプトから継続します (F1: ${((lastHistory.finalF1Score || 0) * 100).toFixed(1)}%)`);
    } else {
      console.log(`\n前回の履歴が見つかりません。初期プロンプトから開始します。`);
      currentPrompt = getBaseCenterLinePrompt();
    }
  } else {
    currentPrompt = getBaseCenterLinePrompt();
  }

  // 履歴を初期化
  const history: OptimizationHistory = createOptimizationHistory(currentPrompt, sampleSet, config);

  let currentF1 = 0;

  // 最適化ループ
  for (let iteration = 0; iteration < config.maxIterations; iteration++) {
    console.log(`\n========== イテレーション ${iteration + 1}/${config.maxIterations} ==========\n`);

    // 1. 現在のプロンプトで評価
    console.log("現在のプロンプトを評価中...");
    const evaluation = await evaluatePrompt(
      anthropic,
      appConfig.googleMapsApiKey,
      sampleSet.samples,
      currentPrompt,
      config.batchSize
    );

    const metrics = evaluation.metrics;
    console.log(`\n評価結果:`);
    console.log(`  Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
    console.log(`  Precision: ${(metrics.precision * 100).toFixed(1)}%`);
    console.log(`  Recall: ${(metrics.recall * 100).toFixed(1)}%`);
    console.log(`  F1 Score: ${(metrics.f1Score * 100).toFixed(1)}%`);
    console.log(`  TP=${metrics.truePositives}, TN=${metrics.trueNegatives}, FP=${metrics.falsePositives}, FN=${metrics.falseNegatives}`);

    // 初回の場合
    if (iteration === 0) {
      currentF1 = metrics.f1Score;

      const iterationResult: OptimizationIteration = {
        iteration,
        currentPrompt,
        evaluation,
        improved: false,
        timestamp: new Date().toISOString(),
      };
      addIteration(history, iterationResult);
      saveHistory(history);

      // エラーがない場合は終了
      if (metrics.falsePositives === 0 && metrics.falseNegatives === 0) {
        console.log("\n完璧なスコア! 最適化を終了します。");
        completeOptimization(history, currentPrompt, metrics.f1Score);
        saveHistory(history);
        break;
      }
    }

    // 2. エラー分析
    console.log("\nエラーパターンを分析中...");
    const errorAnalysis = await analyzeErrors(
      anthropic,
      appConfig.googleMapsApiKey,
      evaluation.samples,
      currentPrompt
    );
    console.log(errorAnalysis.summary);

    // 3. プロンプト候補を生成
    console.log("\nプロンプト候補を生成中...");
    const candidates = await generatePromptCandidates(
      anthropic,
      currentPrompt,
      metrics,
      errorAnalysis,
      config.candidatesPerIteration
    );

    if (candidates.length === 0) {
      console.log("プロンプト候補を生成できませんでした。最適化を終了します。");
      completeOptimization(history, currentPrompt, currentF1);
      saveHistory(history);
      break;
    }

    // 4. 各候補を並列評価
    console.log(`\n候補プロンプトを並列評価中... (同時実行: ${config.parallelCandidates})`);

    // 並列度制限付きで候補を評価
    const candidateEvaluations = await parallelLimit(
      candidates,
      config.parallelCandidates,
      async (candidate, i) => {
        console.log(`\n[開始] 候補 ${i + 1}/${candidates.length}: ${candidate.rationale.substring(0, 40)}...`);
        const candEval = await evaluatePrompt(
          anthropic,
          appConfig.googleMapsApiKey,
          sampleSet.samples,
          candidate.prompt,
          config.batchSize
        );
        console.log(`[完了] 候補 ${i + 1}: F1 Score: ${(candEval.metrics.f1Score * 100).toFixed(1)}%`);
        return candEval;
      }
    );

    // 5. 最良の候補を選択
    let bestIndex = -1;
    let bestF1 = currentF1;

    for (let i = 0; i < candidateEvaluations.length; i++) {
      if (candidateEvaluations[i].metrics.f1Score > bestF1) {
        bestF1 = candidateEvaluations[i].metrics.f1Score;
        bestIndex = i;
      }
    }

    const improved = bestIndex >= 0 && (bestF1 - currentF1) >= config.minImprovement;

    // イテレーション結果を記録
    const iterationResult: OptimizationIteration = {
      iteration,
      currentPrompt,
      evaluation,
      errorAnalysis,
      candidates,
      candidateEvaluations,
      bestCandidateIndex: bestIndex >= 0 ? bestIndex : undefined,
      improved,
      timestamp: new Date().toISOString(),
    };
    addIteration(history, iterationResult);
    saveHistory(history);

    // 6. 改善があれば更新
    if (improved) {
      console.log(`\n改善を確認! 候補${bestIndex + 1}を採用`);
      console.log(`  F1: ${(currentF1 * 100).toFixed(1)}% → ${(bestF1 * 100).toFixed(1)}% (+${((bestF1 - currentF1) * 100).toFixed(1)}%)`);
      currentPrompt = candidates[bestIndex].prompt;
      currentF1 = bestF1;
    } else {
      console.log(`\n改善が見られませんでした (最良: ${(bestF1 * 100).toFixed(1)}%, 現在: ${(currentF1 * 100).toFixed(1)}%)`);
      if (bestF1 - currentF1 < config.minImprovement) {
        console.log(`改善幅 (${((bestF1 - currentF1) * 100).toFixed(2)}%) が最小改善幅 (${(config.minImprovement * 100).toFixed(2)}%) 未満のため終了`);
      }
      completeOptimization(history, currentPrompt, currentF1);
      saveHistory(history);
      break;
    }

    // 最後のイテレーションの場合
    if (iteration === config.maxIterations - 1) {
      completeOptimization(history, currentPrompt, currentF1);
      saveHistory(history);
    }
  }

  // サマリーを表示
  printOptimizationSummary(history);
}

// メイン処理
async function main() {
  const { config: argConfig, prefCode, continueFromLast } = parseArgs();
  const config: OptimizationConfig = {
    ...DEFAULT_CONFIG,
    ...argConfig,
  };

  // 都道府県コードを設定
  setPrefCode(prefCode);

  try {
    await runOptimization(config, continueFromLast);
  } finally {
    // DB接続をクリーンアップ
    await closeSamplerDb();
  }
}

// 実行
main().catch((error) => {
  console.error("エラー:", error);
  process.exit(1);
});
