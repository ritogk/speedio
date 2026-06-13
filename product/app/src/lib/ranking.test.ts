import { describe, expect, it } from "vitest";

import { ranking } from "@/lib/ranking";
import type { TougeVM } from "@/types/touge";

const vm = (partial: Partial<TougeVM>): TougeVM => {
  return {
    id: 0,
    name: "テスト峠",
    routeLabel: "県道",
    lengthKm: 10,
    height: 500,
    corner: 0,
    updown: 0,
    width: 0,
    center: [35, 137],
    poly: [],
    roadSection: [],
    upM: null,
    downM: null,
    unevennessCount: null,
    buildingCnt: null,
    ...partial,
  };
};

describe("rankedList", () => {
  const items = [
    vm({ id: 0, corner: 1.0, updown: 0.0, width: 0.0 }),
    vm({ id: 1, corner: 0.0, updown: 1.0, width: 0.0 }),
    vm({ id: 2, corner: 0.0, updown: 0.0, width: 1.0 }),
  ];

  it("balanceでは全軸が等価でスコアは重み正規化される", () => {
    const ranked = ranking.rank(items, "balance");
    expect(ranked).toHaveLength(3);
    for (const t of ranked) expect(t.score).toBeCloseTo(1 / 3);
  });

  it("cornerプリセットではコーナー特化の道が1位になる", () => {
    const ranked = ranking.rank(items, "corner");
    expect(ranked[0].id).toBe(0);
    // 重み(2.2,0.7,0.8)の正規化: 2.2/3.7
    expect(ranked[0].score).toBeCloseTo(2.2 / 3.7);
  });

  it("relaxプリセットでは道幅の広い道が1位になる", () => {
    expect(ranking.rank(items, "relax")[0].id).toBe(2);
  });

  it("入力配列を破壊しない", () => {
    const before = items.map((t) => t.id);
    ranking.rank(items, "corner");
    expect(items.map((t) => t.id)).toEqual(before);
  });
});

describe("filterByQuery", () => {
  const items = [
    vm({ id: 0, name: "八幡峠", routeLabel: "国道" }),
    vm({ id: 1, name: "椿ライン", routeLabel: "県道" }),
  ];

  it("空クエリはそのまま返す", () => {
    expect(ranking.filterByQuery(items, "  ")).toHaveLength(2);
  });

  it("峠名・道路種別の部分一致で絞り込む", () => {
    expect(ranking.filterByQuery(items, "椿").map((t) => t.id)).toEqual([1]);
    expect(ranking.filterByQuery(items, "国道").map((t) => t.id)).toEqual([0]);
    expect(ranking.filterByQuery(items, "存在しない")).toHaveLength(0);
  });
});
