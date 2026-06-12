// コース図サムネイルの生成と県コード+idでのキャッシュ（idは県内インデックスなので県を跨ぐと重複する）。

import { useTougeStore } from "@/stores/tougeStore";
import { routeThumb } from "@/thumb/routeThumb";
import type { TougeVM } from "@/types/touge";

interface ThumbProvider {
  getThumb(t: TougeVM, w: number, h: number): Promise<string | null>;
}

const cache = new Map<string, Promise<string | null>>();

export const useThumb = (): ThumbProvider => {
  const store = useTougeStore();

  return {
    getThumb: (t, w, h) => {
      const key = `${store.prefCode}:${t.id}`;
      let p = cache.get(key);
      if (!p) {
        p = routeThumb.render(t, w, h).catch(() => null);
        cache.set(key, p);
      }
      return p;
    },
  };
};
