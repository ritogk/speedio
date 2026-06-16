// 県別峠データ(slim版)の取得とメモリキャッシュ。
// /targets は base('/app/') の影響を受けないよう絶対パスでfetchする（開発時はviteのproxyが本番へ中継）。

import { tougeViewModel } from "@/lib/viewmodel";
import type { RawTouge, TougeVM } from "@/types/touge";

interface DataLoader {
  loadPref(code: string): Promise<TougeVM[]>;
}

const createDataLoader = (): DataLoader => {
  const prefCache = new Map<string, TougeVM[]>();
  let globalIdCounter = 0;

  return {
    loadPref: async (code) => {
      const hit = prefCache.get(code);
      if (hit) return hit;
      const res = await fetch(`/targets/${code}/target.slim.json`);
      if (!res.ok)
        throw new Error(`targets/${code}/target.slim.json: HTTP ${res.status}`);
      const raw = (await res.json()) as RawTouge[];
      const base = globalIdCounter;
      globalIdCounter += raw.length;
      const items = raw.map((r, i) => {
        const vm = tougeViewModel.fromRaw(r, base + i);
        vm._pref = code;
        return vm;
      });
      prefCache.set(code, items);
      return items;
    },
  };
};

export const dataLoader = createDataLoader();
