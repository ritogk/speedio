import { Pool } from "pg";
import { AnalysisResult } from "./types";

// DB接続設定
const pool = new Pool({
  user: "postgres",
  password: "postgres",
  database: "speedia",
  host: "localhost",
  port: 5432,
});

// RoadWidthTypeの定義（location.entity.tsと同じ）
export enum RoadWidthType {
  TWO_LANE_SHOULDER = "TWO_LANE_SHOULDER", // ２車線かつ路肩あり
  TWO_LANE = "TWO_LANE", // 2車線かつ路肩なし
  ONE_LANE_SPACIOUS = "ONE_LANE_SPACIOUS", // 1車線かつ2台が余裕を持って通行できる
  ONE_LANE = "ONE_LANE", // 1車線かつ1台のみ通行可能
  UNCONFIRMED = "UNCONFIRMED", // 未確認
}

// 分析結果をDBに保存（UPSERT）
export async function saveResultsToDb(results: AnalysisResult[]): Promise<number> {
  const client = await pool.connect();
  let insertedCount = 0;

  try {
    for (const result of results) {
      const { lat, lng } = result.location;
      const roadWidthType = result.analysis.lanes >= 2 ? RoadWidthType.TWO_LANE : RoadWidthType.ONE_LANE;
      const hasCenterLine = result.analysis.center_line;
      const canPassOncomingWithoutSlowing = result.analysis.can_pass_oncoming_without_slowing;
      const isTunnel = result.analysis.is_tunnel;

      // PostGIS形式でポイントを指定してUPDATEのみ実行
      const query = `
        UPDATE locations SET
          claude_road_width_type = $3,
          claude_has_center_line = $4,
          can_pass_oncoming_without_slowing = $5,
          claude_is_tunnel = $6,
          updated_at = NOW()
        WHERE point = ST_SetSRID(ST_MakePoint($1, $2), 4326)
      `;

      await client.query(query, [
        lng, // PostGISではlng, latの順
        lat,
        roadWidthType,
        hasCenterLine,
        canPassOncomingWithoutSlowing,
        isTunnel,
      ]);

      insertedCount++;
    }
  } finally {
    client.release();
  }

  return insertedCount;
}

// プール終了
export async function closeDb(): Promise<void> {
  await pool.end();
}
