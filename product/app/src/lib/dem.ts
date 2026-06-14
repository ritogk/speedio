// 国土地理院 dem_png の標高値(x=R*65536+G*256+B、2^23は無効値、超過分は負値)と
// Mapbox terrain-rgb の相互変換。

import { tileMath } from "@/lib/tileMath";

interface Dem {
  gsiRgbToElevation(r: number, g: number, b: number): number;
  elevationToTerrainRgb(h: number): [number, number, number];
  convertGsiDemToTerrainRgb(data: Uint8ClampedArray): void;
  /** [lat,lng][] の各地点の標高を国土地理院DEMタイルから取得する */
  sampleElevations(pts: [number, number][], n: number): Promise<number[]>;
}

const INVALID = 8388608; // 2^23

const loadTile = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export const dem: Dem = {
  gsiRgbToElevation: (r, g, b) => {
    const x = r * 65536 + g * 256 + b;
    if (x === INVALID) return 0;
    return x < INVALID ? x * 0.01 : (x - 16777216) * 0.01;
  },

  elevationToTerrainRgb: (h) => {
    const v = Math.round((h + 10000) * 10);
    return [Math.floor(v / 65536) % 256, Math.floor(v / 256) % 256, v % 256];
  },

  convertGsiDemToTerrainRgb: (data) => {
    for (let i = 0; i < data.length; i += 4) {
      const h = dem.gsiRgbToElevation(data[i], data[i + 1], data[i + 2]);
      const [r, g, b] = dem.elevationToTerrainRgb(h);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  },

  sampleElevations: async (pts, n) => {
    const zd = 12;
    const samples: { key: string; ox: number; oy: number }[] = [];
    for (let i = 0; i < n; i++) {
      const p = pts[Math.round((i * (pts.length - 1)) / (n - 1))];
      const [x, y] = tileMath.lngLatToWorldPx(p[1], p[0], zd);
      samples.push({
        key: `${Math.floor(x / 256)}/${Math.floor(y / 256)}`,
        ox: Math.floor(x) % 256,
        oy: Math.floor(y) % 256,
      });
    }
    const tiles: Record<string, Uint8ClampedArray | null> = {};
    const uniqueKeys = [...new Set(samples.map((s) => s.key))];
    await Promise.all(
      uniqueKeys.map(async (key) => {
        try {
          const img = await loadTile(
            `https://cyberjapandata.gsi.go.jp/xyz/dem_png/${zd}/${key}.png`,
          );
          const c = document.createElement("canvas");
          c.width = c.height = 256;
          const cx = c.getContext("2d")!;
          cx.drawImage(img, 0, 0);
          tiles[key] = cx.getImageData(0, 0, 256, 256).data;
        } catch {
          tiles[key] = null;
        }
      }),
    );
    return samples.map((s) => {
      const d = tiles[s.key];
      if (!d) return 0;
      const i = (s.oy * 256 + s.ox) * 4;
      const x = d[i] * 65536 + d[i + 1] * 256 + d[i + 2];
      if (x === INVALID) return 0;
      return x < INVALID ? x * 0.01 : (x - 16777216) * 0.01;
    });
  },
};
