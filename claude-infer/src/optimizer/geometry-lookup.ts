// target.jsonからgeometry_listをロードして次地点を検索するユーティリティ

import * as fs from "fs";
import * as path from "path";
import { TargetEntry } from "../types";
import { getNextPointFromGeometry } from "../streetview";

// 座標のキーを生成（小数点以下6桁で丸め）
function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

// 座標→geometry_listのマップ
interface GeometryLookup {
  geometryMap: Map<string, [number, number][]>;
  validCoords: Set<string>; // 有効な座標のセット
  prefCode: string | null; // 対象の都道府県コード
}

let cachedLookup: GeometryLookup | null = null;
let currentPrefCode: string | null = null;

/**
 * 都道府県コードを設定（buildGeometryLookupの前に呼ぶ）
 */
export function setPrefCode(prefCode: string | null): void {
  if (currentPrefCode !== prefCode) {
    currentPrefCode = prefCode;
    cachedLookup = null; // キャッシュをクリア
  }
}

/**
 * 現在の都道府県コードを取得
 */
export function getPrefCode(): string | null {
  return currentPrefCode;
}

/**
 * target.jsonを読み込んでルックアップを構築
 * prefCodeが設定されていれば、その都道府県のみ対象
 * 設定されていなければ全都道府県を対象
 */
export function buildGeometryLookup(): GeometryLookup {
  if (cachedLookup && cachedLookup.prefCode === currentPrefCode) {
    return cachedLookup;
  }

  const geometryMap = new Map<string, [number, number][]>();
  const validCoords = new Set<string>();
  const targetsDir = path.join(__dirname, "..", "..", "..", "html", "targets");

  if (!fs.existsSync(targetsDir)) {
    console.warn(`警告: targetsディレクトリが見つかりません: ${targetsDir}`);
    cachedLookup = { geometryMap, validCoords, prefCode: currentPrefCode };
    return cachedLookup;
  }

  // 都道府県ディレクトリを決定
  let prefDirs: string[];
  if (currentPrefCode) {
    // 指定された都道府県のみ
    prefDirs = [currentPrefCode];
    console.log(`都道府県コード ${currentPrefCode} を対象`);
  } else {
    // 全都道府県
    prefDirs = fs.readdirSync(targetsDir).filter((name) => {
      const prefPath = path.join(targetsDir, name);
      return fs.statSync(prefPath).isDirectory();
    });
    console.log(`${prefDirs.length}個の都道府県ディレクトリを検出`);
  }

  let totalEntries = 0;
  let totalPoints = 0;

  for (const prefCode of prefDirs) {
    const targetPath = path.join(targetsDir, prefCode, "target.json");

    if (!fs.existsSync(targetPath)) {
      if (currentPrefCode) {
        console.warn(`警告: target.jsonが見つかりません: ${targetPath}`);
      }
      continue;
    }

    try {
      const data = fs.readFileSync(targetPath, "utf-8");
      const entries = JSON.parse(data) as TargetEntry[];

      for (const entry of entries) {
        const { geometry_list, geometry_check_list } = entry;

        // geometry_check_listがない場合はスキップ
        if (!geometry_check_list || geometry_check_list.length < 3) {
          continue;
        }

        // geometry_check_listの各座標をキーとして、geometry_listを登録
        // 先頭と末尾を除く（main.tsと同様）
        const checkPoints = geometry_check_list.slice(1, geometry_check_list.length - 1);

        for (const [lat, lng] of checkPoints) {
          const key = coordKey(lat, lng);
          if (!geometryMap.has(key)) {
            geometryMap.set(key, geometry_list);
            validCoords.add(key);
            totalPoints++;
          }
        }

        totalEntries++;
      }
    } catch (error) {
      // JSON parseエラー等は無視（geometry_check_listがないファイルが多い）
    }
  }

  console.log(`ジオメトリルックアップ構築完了: ${totalEntries}エントリ, ${totalPoints}チェックポイント`);

  cachedLookup = { geometryMap, validCoords, prefCode: currentPrefCode };
  return cachedLookup;
}

/**
 * サンプル地点の次地点を取得（進行方向決定用）
 */
export function getNextPointForSample(lat: number, lng: number): { lat: number; lng: number } | null {
  const lookup = buildGeometryLookup();
  const key = coordKey(lat, lng);

  const geometryList = lookup.geometryMap.get(key);
  if (!geometryList) {
    return null;
  }

  return getNextPointFromGeometry(lat, lng, geometryList);
}

/**
 * 座標がルックアップに存在するかチェック
 */
export function hasGeometryForCoord(lat: number, lng: number): boolean {
  const lookup = buildGeometryLookup();
  const key = coordKey(lat, lng);
  return lookup.validCoords.has(key);
}

/**
 * 有効な座標のリストを取得（サンプリング用）
 */
export function getValidCoords(): Array<{ lat: number; lng: number }> {
  const lookup = buildGeometryLookup();
  const coords: Array<{ lat: number; lng: number }> = [];

  for (const key of lookup.validCoords) {
    const [lat, lng] = key.split(",").map(parseFloat);
    coords.push({ lat, lng });
  }

  return coords;
}

/**
 * キャッシュをクリア（テスト用）
 */
export function clearGeometryCache(): void {
  cachedLookup = null;
}
