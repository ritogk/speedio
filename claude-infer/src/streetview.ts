import axios from "axios";
import * as fs from "fs";
import * as path from "path";

const STREET_VIEW_BASE_URL = "https://maps.googleapis.com/maps/api/streetview";
const STREET_VIEW_METADATA_URL = "https://maps.googleapis.com/maps/api/streetview/metadata";
const TMP_DIR = path.join(__dirname, "..", "tmp");

interface StreetViewMetadata {
  status: string;
  pano_id?: string;
  location?: {
    lat: number;
    lng: number;
  };
  date?: string;
  copyright?: string;
}

// tmpディレクトリを作成
function ensureTmpDir(): void {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
}

// 2点間の方位角（heading）を計算する
// 現在地点から次の地点への進行方向を0-360度で返す
function calculateHeading(
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
  // 0-360度の範囲に正規化
  heading = (heading + 360) % 360;

  return heading;
}

// 画像ファイル名を生成
function generateImageFileName(index: number, lat: number, lng: number): string {
  return `${index}_streetview_${lat}_${lng}.jpg`;
}

// 2点間の距離を計算（簡易版、メートル単位）
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // 地球の半径（メートル）
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// 現在位置からgeometry_list上の最も近いインデックスを見つけ、次のポイントを返す
export function getNextPointFromGeometry(
  currentLat: number,
  currentLng: number,
  geometryList: [number, number][]
): { lat: number; lng: number } | null {
  if (geometryList.length < 2) {
    return null;
  }

  // 最も近いポイントのインデックスを探す
  let minDistance = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < geometryList.length; i++) {
    const [lat, lng] = geometryList[i];
    const distance = calculateDistance(currentLat, currentLng, lat, lng);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
    }
  }

  // 次のインデックスを取得（最後の場合はnull）
  const nextIndex = closestIndex + 1;
  if (nextIndex >= geometryList.length) {
    return null;
  }

  const [nextLat, nextLng] = geometryList[nextIndex];
  return { lat: nextLat, lng: nextLng };
}

// Street View メタデータを取得して利用可能か確認（Google公式画像のみ）
export async function checkStreetViewAvailability(
  lat: number,
  lng: number,
  apiKey: string
): Promise<StreetViewMetadata> {
  const response = await axios.get<StreetViewMetadata>(STREET_VIEW_METADATA_URL, {
    params: {
      location: `${lat},${lng}`,
      key: apiKey,
      source: "outdoor",
    },
  });

  if (response.data.status !== "OK") {
    throw new Error(`Street View not available: ${response.data.status}`);
  }

  // Google公式画像かどうかをcopyrightで確認
  if (response.data.copyright && !response.data.copyright.includes("Google")) {
    throw new Error(`User-contributed image skipped: ${response.data.copyright}`);
  }

  return response.data;
}

// Street View画像を取得してBase64エンコード（tmpに保存）
// nextLat, nextLng を指定すると、その方向を向いた画像を取得する
export async function fetchStreetViewImage(
  index: number,
  lat: number,
  lng: number,
  apiKey: string,
  nextLat?: number,
  nextLng?: number
): Promise<string> {
  // メタデータを確認してStreet Viewが利用可能か検証
  await checkStreetViewAvailability(lat, lng, apiKey);

  // 次の地点が指定されている場合、進行方向を計算
  const params: Record<string, string> = {
    size: "640x480",
    location: `${lat},${lng}`,
    key: apiKey,
    fov: "90",
    pitch: "0",
    source: "outdoor",
  };

  if (nextLat !== undefined && nextLng !== undefined) {
    const heading = calculateHeading(lat, lng, nextLat, nextLng);
    params.heading = heading.toString();
  }

  // Street View Static APIで画像を取得
  const response = await axios.get(STREET_VIEW_BASE_URL, {
    params,
    responseType: "arraybuffer",
  });

  const buffer = Buffer.from(response.data);

  // tmpディレクトリに保存
  ensureTmpDir();
  const fileName = generateImageFileName(index, lat, lng);
  const filePath = path.join(TMP_DIR, fileName);
  fs.writeFileSync(filePath, buffer);

  return buffer.toString("base64");
}
