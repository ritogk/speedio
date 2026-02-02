import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { loadConfig } from "./config";

async function main() {
  const config = loadConfig();

  // テスト座標
  const lat = 35.3342658;
  const lng = 137.0260529;

  // 4方向でテスト
  const headings = [0, 90, 180, 270];
  const names = ["north", "east", "south", "west"];

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const name = names[i];

    console.log(`${name} (heading=${heading}) の画像を取得中...`);

    const response = await axios.get("https://maps.googleapis.com/maps/api/streetview", {
      params: {
        size: "640x480",
        location: `${lat},${lng}`,
        heading: heading.toString(),
        fov: "90",
        pitch: "0",
        key: config.googleMapsApiKey,
        source: "outdoor",
      },
      responseType: "arraybuffer",
    });

    const outputPath = path.join(__dirname, "..", "tmp", `api_${name}.jpg`);
    fs.writeFileSync(outputPath, response.data);
    console.log(`保存: ${outputPath}`);
  }

  console.log("\n完了。tmp/api_*.jpg と tmp/test_*.jpg を比較してください。");
}

main().catch(console.error);
