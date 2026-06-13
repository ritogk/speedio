import { fetchHighResStreetViewImage } from "./panorama";
import { loadConfig } from "./config";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const config = loadConfig();

  // テスト座標
  const lat = 35.3342658;
  const lng = 137.0260529;

  // 4方向でテスト（北、東、南、西）
  const directions = [
    { name: "north", nextLat: lat + 0.01, nextLng: lng },      // 北
    { name: "east", nextLat: lat, nextLng: lng + 0.01 },       // 東
    { name: "south", nextLat: lat - 0.01, nextLng: lng },      // 南
    { name: "west", nextLat: lat, nextLng: lng - 0.01 },       // 西
  ];

  for (const dir of directions) {
    console.log(`\n${dir.name} 方向の画像を取得中...`);
    const imageBase64 = await fetchHighResStreetViewImage(
      lat,
      lng,
      config.googleMapsApiKey,
      dir.nextLat,
      dir.nextLng,
      1280,
      960,
      3
    );

    const outputPath = path.join(__dirname, "..", "tmp", `test_${dir.name}.jpg`);
    fs.writeFileSync(outputPath, Buffer.from(imageBase64, "base64"));
    console.log(`保存: ${outputPath}`);
  }

  console.log("\n完了。tmp/test_*.jpg を確認してください。");
}

main().catch(console.error);
