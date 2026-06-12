import { describe, expect, it } from "vitest";

import { dem } from "@/lib/dem";

describe("gsiRgbToElevation", () => {
  it("正の標高をデコードする", () => {
    // x = 123456 → 1234.56m
    expect(dem.gsiRgbToElevation(1, 226, 64)).toBeCloseTo(1234.56);
  });

  it("無効値(2^23)は0を返す", () => {
    expect(dem.gsiRgbToElevation(128, 0, 0)).toBe(0);
  });

  it("2^23超は負の標高としてデコードする", () => {
    // x = 2^24 - 100 → -1.00m
    expect(dem.gsiRgbToElevation(255, 255, 156)).toBeCloseTo(-1.0);
  });
});

describe("elevationToTerrainRgb", () => {
  it("標高0mはterrain-rgbの基準値(10000*10)になる", () => {
    const [r, g, b] = dem.elevationToTerrainRgb(0);
    expect(r * 65536 + g * 256 + b).toBe(100000);
  });

  it("デコード式 h = -10000 + v*0.1 と往復一致する", () => {
    for (const h of [-500, 0, 776.5, 3776]) {
      const [r, g, b] = dem.elevationToTerrainRgb(h);
      const decoded = -10000 + (r * 65536 + g * 256 + b) * 0.1;
      expect(decoded).toBeCloseTo(h, 1);
    }
  });
});

describe("convertGsiDemToTerrainRgb", () => {
  it("GSIピクセル列をterrain-rgbへ変換し、アルファを255にする", () => {
    // 1px目: 1234.56m、2px目: 無効値（→0m扱い）
    const data = new Uint8ClampedArray([1, 226, 64, 0, 128, 0, 0, 0]);
    dem.convertGsiDemToTerrainRgb(data);
    const h1 = -10000 + (data[0] * 65536 + data[1] * 256 + data[2]) * 0.1;
    expect(h1).toBeCloseTo(1234.56, 1);
    expect(data[3]).toBe(255);
    const h2 = -10000 + (data[4] * 65536 + data[5] * 256 + data[6]) * 0.1;
    expect(h2).toBeCloseTo(0, 1);
    expect(data[7]).toBe(255);
  });
});
