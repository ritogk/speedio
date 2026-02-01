import * as fs from "fs";
import * as path from "path";
import { Location, LocationInput } from "./types";

// geometry_list.jsonのキャッシュ
let geometryListCache: [number, number][] | null = null;

// geometry_list.jsonを読み込み
export function loadGeometryList(filePath?: string): [number, number][] {
  if (geometryListCache) {
    return geometryListCache;
  }

  const geometryPath = filePath || path.join(__dirname, "..", "data", "geometry_list.json");

  if (!fs.existsSync(geometryPath)) {
    console.warn(`警告: geometry_list.jsonが見つかりません: ${geometryPath}`);
    return [];
  }

  const data = fs.readFileSync(geometryPath, "utf-8");
  geometryListCache = JSON.parse(data) as [number, number][];
  return geometryListCache;
}

// 位置情報JSONファイルを読み込み
export function loadLocations(filePath?: string): Location[] {
  const locationsPath = filePath || path.join(__dirname, "..", "data", "geometry_check_list.json");

  if (!fs.existsSync(locationsPath)) {
    console.error(`エラー: 位置情報ファイルが見つかりません: ${locationsPath}`);
    process.exit(1);
  }

  const locationsData = fs.readFileSync(locationsPath, "utf-8");
  const rawLocations: LocationInput[] = JSON.parse(locationsData);

  // 重複削除
  const uniqueLocationsSet = new Set<string>();
  const uniqueLocations: LocationInput[] = [];
  for (const loc of rawLocations) {
    const key = `${loc[0]},${loc[1]}`;
    if (!uniqueLocationsSet.has(key)) {
      uniqueLocationsSet.add(key);
      uniqueLocations.push(loc);
    }
  }
  // [lat, lng] 形式を { lat, lng } 形式に変換（一時的に末尾3件のみ）
  const a = uniqueLocations.map(([lat, lng]) => ({ lat, lng }));
  return a.splice(0,10)
}
