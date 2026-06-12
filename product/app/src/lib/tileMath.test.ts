import { describe, expect, it } from "vitest";

import { tileMath } from "@/lib/tileMath";

describe("lngLatToWorldPx", () => {
  it("z=0 で原点(lng=-180, 北極側)は(0,0)付近、(0,0)は中心(128,128)", () => {
    const [cx, cy] = tileMath.lngLatToWorldPx(0, 0, 0);
    expect(cx).toBeCloseTo(128);
    expect(cy).toBeCloseTo(128);
  });

  it("経度180はワールド右端", () => {
    const [x] = tileMath.lngLatToWorldPx(180, 0, 0);
    expect(x).toBeCloseTo(256);
  });

  it("ズームが1上がると座標は2倍になる", () => {
    const [x0, y0] = tileMath.lngLatToWorldPx(137.5, 36.2, 10);
    const [x1, y1] = tileMath.lngLatToWorldPx(137.5, 36.2, 11);
    expect(x1).toBeCloseTo(x0 * 2);
    expect(y1).toBeCloseTo(y0 * 2);
  });
});

describe("enumerateTiles", () => {
  it("整数ズームはceil(z)をmin/maxにクランプする", () => {
    expect(tileMath.enumerateTiles(12.3, 0, 0, 100, 100).zt).toBe(13);
    expect(tileMath.enumerateTiles(5, 0, 0, 100, 100).zt).toBe(8);
    expect(tileMath.enumerateTiles(17.5, 0, 0, 100, 100).zt).toBe(16);
  });

  it("範囲を覆うタイルを列挙する", () => {
    // z=zt=10 ちょうど → ts=256。0,0から256x256は4タイル（境界含む）
    const { ts, tiles } = tileMath.enumerateTiles(10, 0, 0, 256, 256, 8, 16);
    expect(ts).toBe(256);
    expect(tiles).toHaveLength(4);
    expect(tiles).toContainEqual({ tx: 0, ty: 0 });
    expect(tiles).toContainEqual({ tx: 1, ty: 1 });
  });
});
