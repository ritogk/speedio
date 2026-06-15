// プリセット重み付けによる峠ランキングと検索フィルタ。

import { PRESET_WEIGHTS } from "@/lib/constants";
import type { PresetKey, RankedTouge, TougeVM } from "@/types/touge";

interface Ranking {
  rank(items: TougeVM[], preset: PresetKey): RankedTouge[];
  filterByQuery<T extends TougeVM>(items: T[], query: string): T[];
}

export const ranking: Ranking = {
  rank: (items, preset) => {
    if (preset === "corner") {
      return items
        .map((t) => ({ ...t, score: t.corner ?? 0 }))
        .sort((a, b) => b.score - a.score);
    }
    if (preset === "updown") {
      return items
        .map((t) => ({ ...t, score: t.updown ?? 0 }))
        .sort((a, b) => b.score - a.score);
    }
    if (preset === "seclusion") {
      return items
        .map((t) => ({ ...t, score: t.buildingDensity != null ? -t.buildingDensity : 1 }))
        .sort((a, b) => b.score - a.score);
    }
    if (preset === "uphill") {
      return items
        .map((t) => ({ ...t, score: t.unevennessCount ?? 0 }))
        .sort((a, b) => b.score - a.score);
    }
    const w = PRESET_WEIGHTS[preset];
    const sum = w.corner + w.updown + w.width;
    return items
      .map((t) => ({
        ...t,
        score:
          (t.corner * w.corner + t.updown * w.updown + t.width * w.width) / sum,
      }))
      .sort((a, b) => b.score - a.score);
  },

  filterByQuery: <T extends TougeVM>(items: T[], query: string): T[] => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.routeLabel.toLowerCase().includes(q),
    );
  },
};
