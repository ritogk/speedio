// 入力データの型定義（[lat, lng]の配列）
export type LocationInput = [number, number];

// 内部で使用する位置情報の型定義
export interface Location {
  lat: number;
  lng: number;
}

// LLMからのJSON応答の型定義
export interface RoadAnalysisResponse {
  lanes: number;
  lane_width: number;
  center_line: boolean;
  shoulder_left: number | null;
  shoulder_right: number | null;
  guardrail_left: boolean;
  guardrail_right: boolean;
  can_pass_oncoming_without_slowing: boolean;
  is_tunnel: boolean;
  has_cats_eye: boolean;
}

// トークン使用量と金額
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costJpy: number;
}

// 分析結果の型定義
export interface AnalysisResult {
  location: Location;
  analysis: RoadAnalysisResponse;
  processingTimeMs: number;
  tokenUsage: TokenUsage;
}

// 出力用の結合結果
export interface AnalysisOutput {
  generatedAt: string;
  totalLocations: number;
  totalTokenUsage: TokenUsage;
  results: AnalysisResult[];
}

// target.jsonの各エントリの型定義
export interface TargetEntry {
  geometry_list: [number, number][];
  geometry_check_list: [number, number][];
}
