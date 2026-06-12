import { describe, expect, it } from "vitest";

import { tougeViewModel } from "@/lib/viewmodel";
import type { RawTouge } from "@/types/touge";

const raw = (partial: Partial<RawTouge>): RawTouge => {
  return {
    length: 12345,
    highway: "secondary",
    name: "テスト峠",
    elevation_height: 321.7,
    score_elevation: 0.6,
    score_elevation_unevenness: 0.4,
    score_width: 0.8,
    score_corner_none: 0.3,
    geometry_list: [
      [35.0, 137.0],
      [35.1, 137.1],
      [35.2, 137.2],
    ],
    road_section: [],
    ...partial,
  };
};

describe("toViewModel", () => {
  it("基本フィールドを変換する", () => {
    const t = tougeViewModel.fromRaw(raw({}), 7);
    expect(t.id).toBe(7);
    expect(t.name).toBe("テスト峠");
    expect(t.routeLabel).toBe("県道");
    expect(t.lengthKm).toBe(12.3); // 12345m → 12.3km（100m単位丸め）
    expect(t.height).toBe(322);
    expect(t.corner).toBeCloseTo(0.7); // 1 - score_corner_none
    expect(t.updown).toBeCloseTo(0.5); // (0.6+0.4)/2
    expect(t.width).toBeCloseTo(0.8);
    expect(t.center).toEqual([35.1, 137.1]); // 中点
  });

  it("name配列は ' / ' で結合し、空要素は除く", () => {
    expect(
      tougeViewModel.fromRaw(
        raw({ name: ["A峠", null as unknown as string, "B線"] }),
        0,
      ).name,
    ).toBe("A峠 / B線");
  });

  it("name欠落時はプレースホルダ名になる", () => {
    expect(tougeViewModel.fromRaw(raw({ name: null }), 0).name).toBe(
      "（名称未登録の道）",
    );
    expect(tougeViewModel.fromRaw(raw({ name: [] }), 0).name).toBe(
      "（名称未登録の道）",
    );
  });

  it("highway配列は先頭を採用、未知の値は一般道", () => {
    expect(
      tougeViewModel.fromRaw(raw({ highway: ["trunk", "primary"] }), 0)
        .routeLabel,
    ).toBe("国道(主要)");
    expect(
      tougeViewModel.fromRaw(raw({ highway: "unknown_type" }), 0).routeLabel,
    ).toBe("一般道");
    expect(tougeViewModel.fromRaw(raw({ highway: null }), 0).routeLabel).toBe(
      "一般道",
    );
  });

  it("score欠損時は0-1にクランプされた安全なデフォルトになる", () => {
    const t = tougeViewModel.fromRaw(
      raw({
        score_corner_none: null,
        score_elevation: null,
        score_elevation_unevenness: null,
        score_width: null,
      }),
      0,
    );
    expect(t.corner).toBe(0); // 1 - 1
    expect(t.updown).toBe(0);
    expect(t.width).toBe(0);
  });

  it("範囲外スコアはクランプする", () => {
    const t = tougeViewModel.fromRaw(
      raw({ score_corner_none: -0.5, score_width: 1.5 }),
      0,
    );
    expect(t.corner).toBe(1);
    expect(t.width).toBe(1);
  });

  it("geometry_list欠落時もフォールバック中心を持つ", () => {
    const t = tougeViewModel.fromRaw(raw({ geometry_list: null }), 0);
    expect(t.poly).toEqual([]);
    expect(t.center).toEqual([35.0, 137.0]);
  });
});
