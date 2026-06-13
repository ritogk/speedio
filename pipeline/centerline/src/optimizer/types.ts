// 最適化用型定義

// サンプルデータの型
export interface Sample {
  lng: number;
  lat: number;
  hasCenterLine: boolean; // 教師データ（正解）
}

// サンプルセット（再現性のため保存用）
export interface SampleSet {
  createdAt: string;
  samples: Sample[];
  trueCount: number;
  falseCount: number;
}

// 評価結果
export interface EvaluationResult {
  prompt: string;
  samples: SampleEvaluation[];
  metrics: Metrics;
  totalCostUsd: number;
  evaluatedAt: string;
}

// 個別サンプルの評価結果
export interface SampleEvaluation {
  sample: Sample;
  predicted: boolean;
  correct: boolean;
  errorType?: "FP" | "FN"; // False Positive / False Negative
}

// 評価メトリクス
export interface Metrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
}

// エラーパターン分析結果
export interface ErrorAnalysis {
  fpPatterns: string[]; // False Positiveのパターン
  fnPatterns: string[]; // False Negativeのパターン
  summary: string;
}

// プロンプト候補
export interface PromptCandidate {
  prompt: string;
  rationale: string; // 改善理由
}

// 最適化イテレーションの履歴
export interface OptimizationIteration {
  iteration: number;
  currentPrompt: string;
  evaluation: EvaluationResult;
  errorAnalysis?: ErrorAnalysis;
  candidates?: PromptCandidate[];
  candidateEvaluations?: EvaluationResult[];
  bestCandidateIndex?: number;
  improved: boolean;
  timestamp: string;
}

// 最適化履歴全体
export interface OptimizationHistory {
  startedAt: string;
  completedAt?: string;
  initialPrompt: string;
  finalPrompt?: string;
  initialF1Score: number;
  finalF1Score?: number;
  iterations: OptimizationIteration[];
  sampleSet: SampleSet;
  config: OptimizationConfig;
}

// 最適化設定
export interface OptimizationConfig {
  sampleSize: number;
  maxIterations: number;
  candidatesPerIteration: number;
  minImprovement: number;
  // 並列処理設定
  parallelCandidates: number; // 候補プロンプトの同時評価数
  batchSize: number; // サンプル評価のバッチサイズ
}

// デフォルト設定
export const DEFAULT_CONFIG: OptimizationConfig = {
  sampleSize: 50,
  maxIterations: 5,
  candidatesPerIteration: 3,
  minImprovement: 0.01,
  // 並列処理設定（APIレート制限を考慮）
  parallelCandidates: 3, // 候補プロンプトを同時に評価
  batchSize: 10, // サンプル評価のバッチサイズ
};
