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
    expect(t.updown).toBeCloseTo(0.4); // score_elevation_unevenness のみ
    expect(t.width).toBeCloseTo(0.8);
    expect(t.center).toEqual([35.1, 137.1]); // 中点
    // 新規フィールドのデフォルト
    expect(t.pctStrong).toBe(0);
    expect(t.pctMedium).toBe(0);
    expect(t.pctWeak).toBe(0);
    expect(t.pctStraight).toBe(0); // road_section が空なので 0/1*100 = 0
    expect(t.buildingDensity).toBeNull();
    expect(t.uphillCnt).toBeNull();
    expect(t.downhillCnt).toBeNull();
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
    expect(t.updown).toBe(0); // score_elevation_unevenness null → 0
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

  it("起伏・建物項目は存在すれば丸めて変換、無ければnull", () => {
    const t = tougeViewModel.fromRaw(
      raw({
        elevation_up: 124.8,
        elevation_down: 124.7,
        elevation_unevenness_count: 9,
        building_nearby_cnt: 10,
        uphill_cnt: 3,
        downhill_cnt: 4,
      }),
      0,
    );
    expect(t.upM).toBe(125);
    expect(t.downM).toBe(125);
    expect(t.unevennessCount).toBe(9);
    expect(t.buildingCnt).toBe(10);
    // buildingDensity = 10 / (12.345km) ≒ 0.8
    expect(t.buildingDensity).toBeCloseTo(0.8, 0);
    expect(t.uphillCnt).toBe(3);
    expect(t.downhillCnt).toBe(4);

    // 再生成前の県のslimにはフィールド自体が無い
    const old = tougeViewModel.fromRaw(raw({}), 0);
    expect(old.upM).toBeNull();
    expect(old.downM).toBeNull();
    expect(old.unevennessCount).toBeNull();
    expect(old.buildingCnt).toBeNull();
    expect(old.buildingDensity).toBeNull();
    expect(old.uphillCnt).toBeNull();
    expect(old.downhillCnt).toBeNull();
  });

  it("score_claude_center_line_sectionがあればscore_widthより優先される", () => {
    const t = tougeViewModel.fromRaw(
      raw({ score_claude_center_line_section: 0.6, score_width: 0.8 }),
      0,
    );
    expect(t.width).toBeCloseTo(0.6);
  });

  it("コーナー構成割合を集計する", () => {
    const t = tougeViewModel.fromRaw(
      raw({
        road_section: [
          {
            section_type: "corner",
            corner_level: "strong",
            points: [
              [137, 35],
              [137.1, 35.1],
              [137.2, 35.2],
            ],
          },
          {
            section_type: "corner",
            corner_level: "medium",
            points: [
              [137.2, 35.2],
              [137.3, 35.3],
            ],
          },
          {
            section_type: "straight",
            corner_level: null,
            points: [
              [137.3, 35.3],
              [137.4, 35.4],
              [137.5, 35.5],
            ],
          },
        ],
      }),
      0,
    );
    // strong: 2seg, medium: 1seg, straight: 2seg => total 5
    expect(t.pctStrong).toBe(40);
    expect(t.pctMedium).toBe(20);
    expect(t.pctWeak).toBe(0);
    expect(t.pctStraight).toBe(40);
  });

  it("geometry_list欠落時もフォールバック中心を持つ", () => {
    const t = tougeViewModel.fromRaw(raw({ geometry_list: null }), 0);
    expect(t.poly).toEqual([]);
    expect(t.center).toEqual([35.0, 137.0]);
  });
});
