import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

const STREET_VIEW_METADATA_URL = "https://maps.googleapis.com/maps/api/streetview/metadata";
const TMP_DIR = path.join(__dirname, "..", "tmp");
const PANORAMA_DIR = path.join(TMP_DIR, "panorama");

// パノラマタイルのベースURL（APIキー不要）
const TILE_BASE_URL = "https://streetviewpixels-pa.googleapis.com/v1/tile";

interface StreetViewMetadata {
  status: string;
  pano_id?: string;
  location?: { lat: number; lng: number };
  date?: string;
  copyright?: string;
}

interface PanoramaInfo {
  panoId: string;
  headingOffset: number; // パノラマのヘディングオフセット（度）
}

// ディレクトリを作成
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Street View メタデータを取得してpano_idを返す
export async function getPanoramaId(
  lat: number,
  lng: number,
  apiKey: string
): Promise<string> {
  const response = await axios.get<StreetViewMetadata>(STREET_VIEW_METADATA_URL, {
    params: {
      location: `${lat},${lng}`,
      key: apiKey,
      source: "outdoor",
    },
  });

  if (response.data.status !== "OK" || !response.data.pano_id) {
    throw new Error(`Street View not available: ${response.data.status}`);
  }

  if (response.data.copyright && !response.data.copyright.includes("Google")) {
    throw new Error(`User-contributed image skipped: ${response.data.copyright}`);
  }

  return response.data.pano_id;
}

// パノラマのヘディングオフセットを取得
async function getPanoramaHeadingOffset(panoId: string): Promise<number> {
  try {
    const url = `https://www.google.com/maps/photometa/v1?authuser=0&hl=ja&gl=jp&pb=!1m4!1smaps_sv.tactile!11m2!2m1!1b1!2m2!1sja!2sjp!3m3!1m2!1e2!2s${panoId}!4m57!1e1!1e2!1e3!1e4!1e5!1e6!1e8!1e12!2m1!1e1!4m1!1i48!5m1!1e1!5m1!1e2!6m1!1e1!6m1!1e2!9m36!1m3!1e2!2b1!3e2!1m3!1e2!2b0!3e3!1m3!1e3!2b1!3e2!1m3!1e3!2b0!3e3!1m3!1e8!2b0!3e3!1m3!1e1!2b0!3e3!1m3!1e4!2b0!3e3!1m3!1e10!2b1!3e2!1m3!1e10!2b0!3e3`;

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    // レスポンスから heading を抽出
    // フォーマット: )]}' の後にJSONが続く
    const text = response.data as string;
    const jsonStr = text.replace(/^\)\]\}'\n/, "");
    const data = JSON.parse(jsonStr);

    // data[1][0][5][0][1][2][0] にheadingがある
    // 構造: [[],[[[1],[2,"panoId"],...,[[[1],[[null,null,lat,lng],[...],[heading,pitch,roll],...]]]]]]
    const headingData = data?.[1]?.[0]?.[5]?.[0]?.[1]?.[2];
    if (headingData && Array.isArray(headingData) && headingData.length >= 1) {
      const heading = headingData[0];
      if (typeof heading === "number") {
        return heading;
      }
    }

    // デフォルトは0（オフセットなし）
    console.warn(`  警告: パノラマ ${panoId} のヘディングオフセットを取得できませんでした`);
    return 0;
  } catch (error) {
    console.warn(`  警告: photometa取得エラー:`, error instanceof Error ? error.message : error);
    return 0;
  }
}

// パノラマタイルを取得
async function fetchPanoramaTile(
  panoId: string,
  zoom: number,
  x: number,
  y: number
): Promise<Buffer> {
  ensureDir(PANORAMA_DIR);
  const fileName = `${panoId}_z${zoom}_x${x}_y${y}.jpg`;
  const filePath = path.join(PANORAMA_DIR, fileName);

  // キャッシュがあれば使用
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }

  const url = `${TILE_BASE_URL}?cb_client=maps_sv.tactile&panoid=${panoId}&x=${x}&y=${y}&zoom=${zoom}&nbt=1&fover=2`;

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    validateStatus: (status) => status < 500, // 4xx も受け入れて判定
  });

  if (response.status !== 200) {
    throw new Error(`Tile not available: ${response.status}`);
  }

  const buffer = Buffer.from(response.data);
  fs.writeFileSync(filePath, buffer);
  return buffer;
}

// パノラマタイルを結合してフルパノラマを作成（必要に応じて低いzoomレベルにフォールバック）
async function buildPanorama(panoId: string, requestedZoom: number): Promise<Buffer> {
  ensureDir(PANORAMA_DIR);

  // 利用可能なzoomレベルを試す（requestedZoomから下げていく）
  for (let zoom = requestedZoom; zoom >= 1; zoom--) {
    const cacheFile = path.join(PANORAMA_DIR, `${panoId}_full_z${zoom}.jpg`);

    // キャッシュがあれば使用
    if (fs.existsSync(cacheFile)) {
      if (zoom < requestedZoom) {
        console.log(`  パノラマキャッシュ使用 (zoom=${zoom}、要求より低い解像度)`);
      }
      return fs.readFileSync(cacheFile);
    }

    // zoom levelに応じたタイル数
    // zoom 0: 1x1, zoom 1: 2x1, zoom 2: 4x2, zoom 3: 8x4, zoom 4: 16x8, zoom 5: 32x16
    const tilesX = Math.pow(2, zoom);
    const tilesY = Math.pow(2, zoom - 1);
    const tileSize = 512;

    console.log(`  パノラマタイル取得中: zoom=${zoom}, tiles=${tilesX}x${tilesY}`);

    // 全タイルを取得
    const tiles: { x: number; y: number; buffer: Buffer }[] = [];
    let tilesFailed = false;

    for (let y = 0; y < tilesY && !tilesFailed; y++) {
      for (let x = 0; x < tilesX && !tilesFailed; x++) {
        try {
          const buffer = await fetchPanoramaTile(panoId, zoom, x, y);
          tiles.push({ x, y, buffer });
        } catch (error) {
          console.log(`  タイル取得失敗 (zoom=${zoom}, x=${x}, y=${y})、より低い解像度を試行...`);
          tilesFailed = true;
        }
      }
    }

    if (tilesFailed) {
      continue; // 次の低いzoomレベルを試す
    }

    // タイルを結合
    const width = tilesX * tileSize;
    const height = tilesY * tileSize;

    const compositeInputs = tiles.map((tile) => ({
      input: tile.buffer,
      left: tile.x * tileSize,
      top: tile.y * tileSize,
    }));

    const panorama = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .composite(compositeInputs)
      .jpeg({ quality: 90 })
      .toBuffer();

    fs.writeFileSync(cacheFile, panorama);
    return panorama;
  }

  throw new Error(`パノラマタイルを取得できませんでした: ${panoId}`);
}

// 等距円筒図法（equirectangular）からパースペクティブ投影で画像を切り出す
async function extractPerspective(
  panoramaBuffer: Buffer,
  heading: number, // 0-360度
  pitch: number, // -90 to 90度
  fov: number, // 視野角（度）
  outputWidth: number,
  outputHeight: number
): Promise<Buffer> {
  const panorama = sharp(panoramaBuffer);
  const metadata = await panorama.metadata();
  const panoWidth = metadata.width!;
  const panoHeight = metadata.height!;

  // ラジアンに変換
  const headingRad = (heading * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;
  const fovRad = (fov * Math.PI) / 180;

  // 出力画像の各ピクセルに対応するパノラマの座標を計算
  const outputPixels = new Uint8Array(outputWidth * outputHeight * 3);
  const rawPanorama = await panorama.raw().toBuffer();

  const halfFov = fovRad / 2;
  const aspectRatio = outputWidth / outputHeight;

  for (let outY = 0; outY < outputHeight; outY++) {
    for (let outX = 0; outX < outputWidth; outX++) {
      // 正規化された画面座標 (-1 to 1)
      const nx = (2 * outX) / outputWidth - 1;
      const ny = 1 - (2 * outY) / outputHeight;

      // 視線ベクトルを計算
      const x = nx * Math.tan(halfFov) * aspectRatio;
      const y = ny * Math.tan(halfFov);
      const z = 1;

      // 正規化
      const len = Math.sqrt(x * x + y * y + z * z);
      let vx = x / len;
      let vy = y / len;
      let vz = z / len;

      // pitch回転（X軸周り）
      const cosPitch = Math.cos(pitchRad);
      const sinPitch = Math.sin(pitchRad);
      const vy2 = vy * cosPitch - vz * sinPitch;
      const vz2 = vy * sinPitch + vz * cosPitch;
      vy = vy2;
      vz = vz2;

      // heading回転（Y軸周り）
      const cosHeading = Math.cos(headingRad);
      const sinHeading = Math.sin(headingRad);
      const vx2 = vx * cosHeading + vz * sinHeading;
      const vz3 = -vx * sinHeading + vz * cosHeading;
      vx = vx2;
      vz = vz3;

      // 球面座標に変換
      const theta = Math.atan2(vx, vz); // 経度 (-PI to PI)
      const phi = Math.asin(vy); // 緯度 (-PI/2 to PI/2)

      // パノラマ画像の座標に変換
      let panoX = ((theta + Math.PI) / (2 * Math.PI)) * panoWidth;
      let panoY = ((Math.PI / 2 - phi) / Math.PI) * panoHeight;

      // 範囲を制限
      panoX = Math.max(0, Math.min(panoWidth - 1, panoX));
      panoY = Math.max(0, Math.min(panoHeight - 1, panoY));

      // 最近傍補間でピクセル値を取得
      const srcX = Math.floor(panoX);
      const srcY = Math.floor(panoY);
      const srcIdx = (srcY * panoWidth + srcX) * 3;
      const dstIdx = (outY * outputWidth + outX) * 3;

      outputPixels[dstIdx] = rawPanorama[srcIdx];
      outputPixels[dstIdx + 1] = rawPanorama[srcIdx + 1];
      outputPixels[dstIdx + 2] = rawPanorama[srcIdx + 2];
    }
  }

  return sharp(outputPixels, {
    raw: { width: outputWidth, height: outputHeight, channels: 3 },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

// 高解像度のStreet View画像を生成
// nextLat, nextLng を指定すると、その方向を向いた画像を取得する
export async function fetchHighResStreetViewImage(
  lat: number,
  lng: number,
  apiKey: string,
  nextLat: number,
  nextLng: number,
  outputWidth: number = 1280,
  outputHeight: number = 960,
  zoom: number = 3 // zoom 3 = 4096x2048, zoom 4 = 8192x4096
): Promise<string> {
  ensureDir(TMP_DIR);

  console.log(`高解像度Street View画像取得: (${lat}, ${lng}) → (${nextLat}, ${nextLng})`);

  // 実世界のheadingを計算
  const realWorldHeading = calculateHeading(lat, lng, nextLat, nextLng);
  const pitch = 0;
  const fov = 90;

  // キャッシュファイル名
  const cacheFile = path.join(
    TMP_DIR,
    `highres_${lat}_${lng}_h${Math.round(realWorldHeading)}_${outputWidth}x${outputHeight}.jpg`
  );

  if (fs.existsSync(cacheFile)) {
    console.log(`  ローカル高解像度画像を使用`);
    const buffer = fs.readFileSync(cacheFile);
    return buffer.toString("base64");
  }

  // pano_idを取得
  const panoId = await getPanoramaId(lat, lng, apiKey);
  console.log(`  pano_id: ${panoId}`);

  // パノラマのヘディングオフセットを取得
  const headingOffset = await getPanoramaHeadingOffset(panoId);
  console.log(`  heading offset: ${headingOffset.toFixed(2)}°`);

  // パノラマ座標系でのheadingを計算
  // パノラマのpanoX=0がheadingOffset度を向いているので、
  // 実世界のheadingからoffsetを引く
  const panoramaHeading = (realWorldHeading - headingOffset + 360) % 360;
  console.log(`  realWorldHeading: ${realWorldHeading.toFixed(2)}° → panoramaHeading: ${panoramaHeading.toFixed(2)}°`);

  // パノラマを構築
  const panorama = await buildPanorama(panoId, zoom);

  // パースペクティブ投影で切り出し
  const perspective = await extractPerspective(
    panorama,
    panoramaHeading,
    pitch,
    fov,
    outputWidth,
    outputHeight
  );

  // キャッシュに保存
  fs.writeFileSync(cacheFile, perspective);

  return perspective.toString("base64");
}

// 2点間の方位角を計算
export function calculateHeading(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const toDegrees = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const deltaLng = toRadians(toLng - fromLng);

  const x = Math.sin(deltaLng) * Math.cos(lat2);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  let heading = toDegrees(Math.atan2(x, y));
  heading = (heading + 360) % 360;

  return heading;
}
