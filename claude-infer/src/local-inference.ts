/**
 * ローカルMLモデル（ViT-Small）を使った推論クライアント
 * Python FastAPIサーバーと連携
 */

import axios from "axios";

const LOCAL_SERVER_URL = process.env.LOCAL_INFERENCE_URL || "http://localhost:8000";

interface PredictResult {
  has_center_line: boolean;
  probability: number;
  confidence: number;
}

interface BatchPredictResult {
  results: PredictResult[];
}

/**
 * ヘルスチェック
 */
export async function checkLocalServerHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${LOCAL_SERVER_URL}/health`, { timeout: 5000 });
    return response.data.status === "ok" && response.data.model_loaded;
  } catch {
    return false;
  }
}

/**
 * Base64画像から中央線を予測
 */
export async function predictCenterLineFromBase64(imageBase64: string): Promise<{
  hasCenterLine: boolean;
  confidence: number;
  probability: number;
}> {
  const response = await axios.post<PredictResult>(`${LOCAL_SERVER_URL}/predict`, {
    image_base64: imageBase64,
  });

  return {
    hasCenterLine: response.data.has_center_line,
    confidence: response.data.confidence,
    probability: response.data.probability,
  };
}

/**
 * 画像パスから中央線を予測
 */
export async function predictCenterLineFromPath(imagePath: string): Promise<{
  hasCenterLine: boolean;
  confidence: number;
  probability: number;
}> {
  const response = await axios.post<PredictResult>(`${LOCAL_SERVER_URL}/predict`, {
    image_path: imagePath,
  });

  return {
    hasCenterLine: response.data.has_center_line,
    confidence: response.data.confidence,
    probability: response.data.probability,
  };
}

/**
 * バッチ推論
 */
export async function predictCenterLineBatch(images: string[]): Promise<
  Array<{
    hasCenterLine: boolean;
    confidence: number;
    probability: number;
  }>
> {
  const response = await axios.post<BatchPredictResult>(`${LOCAL_SERVER_URL}/predict_batch`, {
    images,
  });

  return response.data.results.map((r) => ({
    hasCenterLine: r.has_center_line,
    confidence: r.confidence,
    probability: r.probability,
  }));
}

/**
 * evaluator.tsとの互換インターフェース
 * Claude APIの代わりにローカルモデルで推論
 */
export async function evaluateWithLocalModel(
  imageBase64: string
): Promise<{
  center_line: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
}> {
  const result = await predictCenterLineFromBase64(imageBase64);

  // confidence levelを計算
  let confidenceLevel: "high" | "medium" | "low";
  if (result.confidence >= 0.8) {
    confidenceLevel = "high";
  } else if (result.confidence >= 0.6) {
    confidenceLevel = "medium";
  } else {
    confidenceLevel = "low";
  }

  return {
    center_line: result.hasCenterLine,
    confidence: confidenceLevel,
    reason: `ViT-Small model prediction (prob=${result.probability.toFixed(3)})`,
  };
}
