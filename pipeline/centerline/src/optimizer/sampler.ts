// DBからサンプル抽出（層化サンプリング）

import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import { Sample, SampleSet } from "./types";
import { buildGeometryLookup } from "./geometry-lookup";

const pool = new Pool({
  user: "postgres",
  password: "postgres",
  database: "speedia",
  host: "localhost",
  port: 5432,
});

const OUTPUT_DIR = path.join(__dirname, "output");

// 座標のキーを生成（小数点以下6桁で丸め）
function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/**
 * 層化サンプリングでサンプルを抽出
 * geometry_check_listに存在する座標のみを対象とする
 */
export async function extractSamples(totalSize: number): Promise<Sample[]> {
  // ジオメトリルックアップを構築して有効座標を取得
  const lookup = buildGeometryLookup();
  const validCoords = lookup.validCoords;

  console.log(`有効座標数: ${validCoords.size}`);

  const halfSize = Math.floor(totalSize / 2);
  const client = await pool.connect();

  try {
    // has_center_line が設定されている全レコードを取得
    const result = await client.query<{
      lng: number;
      lat: number;
      has_center_line: boolean;
    }>(
      `SELECT ST_X(point) AS lng, ST_Y(point) AS lat, has_center_line
       FROM locations
       WHERE has_center_line IS NOT NULL`
    );

    // geometry_check_listに存在する座標のみをフィルタリング
    const trueRecords: Sample[] = [];
    const falseRecords: Sample[] = [];

    for (const row of result.rows) {
      const key = coordKey(row.lat, row.lng);
      if (validCoords.has(key)) {
        const sample: Sample = {
          lat: row.lat,
          lng: row.lng,
          hasCenterLine: row.has_center_line,
        };
        if (row.has_center_line) {
          trueRecords.push(sample);
        } else {
          falseRecords.push(sample);
        }
      }
    }

    console.log(`フィルタ後: true=${trueRecords.length}, false=${falseRecords.length}`);

    // シャッフル
    shuffleArray(trueRecords);
    shuffleArray(falseRecords);

    // 均等にサンプリング
    const trueSamples = trueRecords.slice(0, halfSize);
    const falseSamples = falseRecords.slice(0, halfSize);

    // 結合してシャッフル
    const allSamples = [...trueSamples, ...falseSamples];
    shuffleArray(allSamples);

    return allSamples;
  } finally {
    client.release();
  }
}

/**
 * サンプルセットを作成して保存
 */
export async function createAndSaveSampleSet(totalSize: number): Promise<SampleSet> {
  const samples = await extractSamples(totalSize);

  const trueCount = samples.filter((s) => s.hasCenterLine).length;
  const falseCount = samples.filter((s) => !s.hasCenterLine).length;

  const sampleSet: SampleSet = {
    createdAt: new Date().toISOString(),
    samples,
    trueCount,
    falseCount,
  };

  // JSONに保存
  ensureOutputDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(OUTPUT_DIR, `sample_set_${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(sampleSet, null, 2), "utf-8");

  console.log(`サンプルセットを保存: ${filePath}`);
  console.log(`  - true: ${trueCount}件, false: ${falseCount}件`);

  return sampleSet;
}

/**
 * 保存されたサンプルセットを読み込み
 */
export function loadSampleSet(filePath: string): SampleSet {
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as SampleSet;
}

/**
 * 利用可能なサンプル数を確認（geometry_check_listフィルタ適用後）
 */
export async function getAvailableSampleCounts(): Promise<{ trueCount: number; falseCount: number }> {
  // ジオメトリルックアップを構築
  const lookup = buildGeometryLookup();
  const validCoords = lookup.validCoords;

  const client = await pool.connect();

  try {
    const result = await client.query<{
      lng: number;
      lat: number;
      has_center_line: boolean;
    }>(
      `SELECT ST_X(point) AS lng, ST_Y(point) AS lat, has_center_line
       FROM locations
       WHERE has_center_line IS NOT NULL`
    );

    let trueCount = 0;
    let falseCount = 0;

    for (const row of result.rows) {
      const key = coordKey(row.lat, row.lng);
      if (validCoords.has(key)) {
        if (row.has_center_line) {
          trueCount++;
        } else {
          falseCount++;
        }
      }
    }

    return { trueCount, falseCount };
  } finally {
    client.release();
  }
}

/**
 * DBプールを終了
 */
export async function closeSamplerDb(): Promise<void> {
  await pool.end();
}

// ヘルパー関数
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}
