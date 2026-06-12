// URLクエリ(?pref=&preset=) ←→ store の同期。初期値は URL > localStorage の順で復元。

import { watch } from "vue";

import { isPresetKey, PREFECTURES } from "@/lib/constants";
import { useTougeStore } from "@/stores/tougeStore";

const safeGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const useUrlState = (): void => {
  const store = useTougeStore();
  const params = new URLSearchParams(location.search);

  const initPreset = params.get("preset") ?? safeGet("touge.preset");
  if (isPresetKey(initPreset)) store.setPreset(initPreset);

  const initPref = params.get("pref") ?? safeGet("touge.pref");
  if (initPref && PREFECTURES[initPref]) void store.switchPref(initPref);

  watch(
    () => [store.prefCode, store.preset] as const,
    ([pref, preset]) => {
      const p = new URLSearchParams(location.search);
      if (pref) p.set("pref", pref);
      else p.delete("pref");
      if (preset !== "balance") p.set("preset", preset);
      else p.delete("preset");
      const qs = p.toString();
      history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
    },
  );
};
