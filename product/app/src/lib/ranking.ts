// プリセット重み付けによる峠ランキングと検索フィルタ。

import { PRESET_WEIGHTS } from "@/lib/constants";
import type { PresetKey, RankedTouge, TougeVM } from "@/types/touge";

interface Ranking {
  rank(items: TougeVM[], preset: PresetKey): RankedTouge[];
  filterByQuery<T extends TougeVM>(items: T[], query: string): T[];
}

export const ranking: Ranking = {
  rank: (items, preset) => {
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
