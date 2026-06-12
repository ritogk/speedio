import { describe, expect, it } from "vitest";

import { geo } from "@/lib/geo";

describe("fadeOf", () => {
  it("1件のときは常に1", () => {
    expect(geo.fadeOf(0, 1, 0.25)).toBe(1);
  });

  it("先頭=1.0、末尾=floor で線形に減衰する", () => {
    expect(geo.fadeOf(0, 10, 0.25)).toBe(1);
    expect(geo.fadeOf(9, 10, 0.25)).toBeCloseTo(0.25);
    expect(geo.fadeOf(4, 9, 0.25)).toBeCloseTo(1 - 0.75 * 0.5);
  });
});

describe("routeBearing", () => {
  it("北向きの道は0度", () => {
    expect(
      geo.routeBearing([
        [35.0, 137.0],
        [36.0, 137.0],
      ]),
    ).toBeCloseTo(0);
  });

  it("東向きの道は90度", () => {
    expect(
      geo.routeBearing([
        [35.0, 137.0],
        [35.0, 138.0],
      ]),
    ).toBeCloseTo(90);
  });
});

describe("decimate", () => {
  it("max以下はそのまま返す", () => {
    const pts = [1, 2, 3];
    expect(geo.decimate(pts, 5)).toBe(pts);
  });

  it("max点に間引き、先頭と末尾は保持する", () => {
    const pts = Array.from({ length: 1000 }, (_, i) => i);
    const out = geo.decimate(pts, 240);
    expect(out).toHaveLength(240);
    expect(out[0]).toBe(0);
    expect(out[239]).toBe(999);
  });
});

describe("buildRangeRings", () => {
  it("10km刻みで100kmまで10本の円を生成する", () => {
    const rings = geo.buildRangeRings(35.0, 137.0);
    expect(rings).toHaveLength(10);
    expect(rings.map((r) => r.r)).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ]);
  });

  it("円は129点で閉じ、ラベルは北端に置かれる", () => {
    const [first] = geo.buildRangeRings(35.0, 137.0);
    expect(first.ring).toHaveLength(129);
    expect(first.ring[0][0]).toBeCloseTo(first.ring[128][0]);
    expect(first.labelPos[1]).toBeGreaterThan(35.0);
    // 10km ≈ 緯度0.0898度
    expect(first.labelPos[1] - 35.0).toBeCloseTo(10000 / 111320, 5);
  });
});
