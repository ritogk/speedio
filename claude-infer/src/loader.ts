import * as fs from "fs";
import * as path from "path";
import { TargetEntry } from "./types";

// target.jsonを読み込み
export function loadTargetEntries(filePath?: string): TargetEntry[] {
  const targetPath = filePath || path.join(__dirname, "..", "..", "html", "targets", "23", "target.json");

  if (!fs.existsSync(targetPath)) {
    console.error(`エラー: target.jsonが見つかりません: ${targetPath}`);
    process.exit(1);
  }

  const data = fs.readFileSync(targetPath, "utf-8");
  return JSON.parse(data) as TargetEntry[];
}
