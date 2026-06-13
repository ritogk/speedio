import { fetchHighResStreetViewImage } from "./panorama";
import { loadConfig } from "./config";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const config = loadConfig();

  // テスト座標
  const lat = 36.183217;
  const lng = 137.370532;

  // 次のポイント（heading計算用）
  const nextLat = 36.183582;
  const nextLng = 137.37108;

  console.log(`${lat}, ${lng}`);
  console.log(`${nextLat}, ${nextLng}`);

  console.log("高解像度画像を取得中...");
  const imageBase64 = await fetchHighResStreetViewImage(
    lat,
    lng,
    config.googleMapsApiKey,
    nextLat,
    nextLng,
    1280, // width
    960, // height
    3 // zoom level
  );

  // ファイルに保存して確認
  const outputPath = path.join(__dirname, "..", "tmp", "test_highres.jpg");
  fs.writeFileSync(outputPath, Buffer.from(imageBase64, "base64"));
  console.log(`画像を保存しました: ${outputPath}`);
}

main().catch(console.error);
