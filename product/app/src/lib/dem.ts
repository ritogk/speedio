// 国土地理院 dem_png の標高値(x=R*65536+G*256+B、2^23は無効値、超過分は負値)と
// Mapbox terrain-rgb の相互変換。

interface Dem {
  gsiRgbToElevation(r: number, g: number, b: number): number;
  elevationToTerrainRgb(h: number): [number, number, number];
  convertGsiDemToTerrainRgb(data: Uint8ClampedArray): void;
}

const INVALID = 8388608; // 2^23

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
};
