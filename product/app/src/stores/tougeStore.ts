// アプリの中心状態: 県データ・ランキング・検索・選択・シート開閉。

import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { useToast } from "@/composables/useToast";
import {
  ADJACENT,
  MOBILE_MAX_WIDTH,
  PAGE_N,
  PREFECTURES,
  PRESET_WEIGHTS,
} from "@/lib/constants";
import { dataLoader } from "@/lib/dataLoader";
import { ranking } from "@/lib/ranking";
import type { PresetKey, RankedTouge, TougeVM } from "@/types/touge";

export type SheetState = "peek" | "half" | "full" | "card-peek";

export type SelectSource = "card" | "map" | "none";

export interface Selection {
  id: number | null;
  source: SelectSource;
  /** 同じ峠の再選択でもwatcherが発火するよう単調増加させる */
  seq: number;
}

const isMobile = () => window.innerWidth <= MOBILE_MAX_WIDTH;

const persist = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // プライベートモード等で失敗しても動作に支障なし
  }
};

/** 2点間のハーバーサイン距離 (km) */
const haversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const useTougeStore = defineStore("touge", () => {
  const { show: toast } = useToast();

  // state
  const prefCode = ref<string | null>(null);
  const preset = ref<PresetKey>("balance");
  const items = ref<TougeVM[]>([]);
  const searchQuery = ref("");
  const visibleCount = ref(PAGE_N);
  const selection = ref<Selection>({ id: null, source: "none", seq: 0 });
  const loading = ref(false);
  const loadingText = ref("読み込み中…");
  const loadSeq = ref(0);
  /** loadSeq増加時にMapViewがfitBoundsすべきかどうか。removePref/clearAllPrefsやnearby(自前fitBounds)ではfalse */
  const fitBoundsOnLoad = ref(true);
  const sheetState = ref<SheetState>("peek");
  const sidebarHidden = ref(false);
  /** 3Dオーバーレイで表示中の峠。null なら非表示 */
  const overlay3dTarget = ref<TougeVM | null>(null);
  /** 道幅スコアの下限フィルタ (0-1) */
  const widthFilter = ref<number>(0.85);
  /** 距離フィルタ (km)。null=無制限 */
  const distanceFilter = ref<number | null>(null);
  /** ユーザーの現在位置。null=未取得 */
  const userLatLng = ref<[number, number] | null>(null);
  /** 読み込み済み県コードの集合 */
  const loadedPrefs = ref<Set<string>>(new Set());

  // getters
  const ranked = computed<RankedTouge[]>(() => {
    let list = ranking.rank(items.value, preset.value);

    // 距離の付与
    if (userLatLng.value) {
      const [uLat, uLng] = userLatLng.value;
      list = list.map((t) => ({
        ...t,
        distanceKm: haversineKm(uLat, uLng, t.center[0], t.center[1]),
      }));
      if (preset.value === "nearby") {
        list.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      }
    }

    // フィルタ適用
    if (widthFilter.value != null) {
      list = list.filter((t) => t.width >= widthFilter.value);
    }
    if (distanceFilter.value != null && userLatLng.value) {
      list = list.filter(
        (t) => (t.distanceKm ?? Infinity) <= distanceFilter.value!,
      );
    }

    return list;
  });

  const hasQuery = computed(() => searchQuery.value.trim().length > 0);

  const visibleCards = computed<{ t: RankedTouge; rank: number }[]>(() => {
    const pairs = ranked.value.map((t, rank) => ({ t, rank }));
    if (hasQuery.value) {
      const hit = new Set(
        ranking.filterByQuery(ranked.value, searchQuery.value).map((t) => t.id),
      );
      return pairs.filter(({ t }) => hit.has(t.id));
    }
    return pairs.slice(0, visibleCount.value);
  });

  const moreRemaining = computed(() =>
    hasQuery.value ? 0 : Math.max(0, ranked.value.length - visibleCount.value),
  );

  const resultCountLabel = computed(() => {
    if (!ranked.value.length && !hasQuery.value) return "";
    return hasQuery.value
      ? `検索ヒット ${visibleCards.value.length}件`
      : `全${ranked.value.length}件中 ${visibleCards.value.length}件表示`;
  });

  const prefLabel = computed(() => {
    const names = [...loadedPrefs.value].sort().map((c) => PREFECTURES[c]).filter(Boolean);
    return names.length ? names.join("・") : "未選択";
  });

  const selectedId = computed(() => selection.value.id);

  const selected = computed<RankedTouge | null>(() =>
    selection.value.id == null
      ? null
      : (ranked.value.find((t) => t.id === selection.value.id) ?? null),
  );

  // actions
  const select = (id: number | null, source: SelectSource = "none") => {
    selection.value = { id, source, seq: selection.value.seq + 1 };
    if (id != null && isMobile()) {
      sheetState.value = source === "card" ? "card-peek" : "half";
    }
  };

  const revealAndSelect = (id: number) => {
    const rank = ranked.value.findIndex((t) => t.id === id);
    if (rank < 0) return;
    if (hasQuery.value) searchQuery.value = "";
    if (rank + 1 > visibleCount.value) {
      visibleCount.value = Math.ceil((rank + 1) / PAGE_N) * PAGE_N;
    }
    select(id, "map");
  };

  const setPreset = (p: PresetKey) => {
    if (!(p in PRESET_WEIGHTS)) return;
    preset.value = p;
    if (p !== "nearby") persist("touge.preset", p);
    visibleCount.value = PAGE_N;
  };

  const showMore = () => {
    visibleCount.value += PAGE_N;
  };

  const setSheet = (state: SheetState) => {
    if (!isMobile()) return;
    sheetState.value = state;
  };

  const toggleSidebar = () => {
    sidebarHidden.value = !sidebarHidden.value;
  };

  const open3D = (touge: TougeVM) => {
    overlay3dTarget.value = touge;
  };

  const close3D = () => {
    overlay3dTarget.value = null;
  };

  const loadAdjacentForNearby = async (code: string) => {
    const codes = [code, ...(ADJACENT[code] || [])];
    loadedPrefs.value = new Set(codes);
    loading.value = true;
    loadingText.value = `周辺${codes.length}県のデータを読み込み中…`;
    try {
      const results = await Promise.all(codes.map((c) => dataLoader.loadPref(c)));
      const seen = new Set<number>();
      items.value = results.flat().filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
      fitBoundsOnLoad.value = false; // PresetChips does its own fitBounds
      loadSeq.value++;
    } catch (err) {
      console.error(err);
      toast("周辺県のデータ読み込みに失敗しました");
    } finally {
      loading.value = false;
    }
  };

  /** 追加読み込み（既存データを保持したまま新しい県を追加） */
  const addPrefs = async (codes: string[]) => {
    loading.value = true;
    loadingText.value = `周辺${codes.length}県のデータを追加読み込み中…`;
    try {
      const results = await Promise.all(codes.map((c) => dataLoader.loadPref(c)));
      const seen = new Set(items.value.map((t) => t.id));
      items.value = [...items.value, ...results.flat().filter((t) => !seen.has(t.id))];
      fitBoundsOnLoad.value = true;
      loadSeq.value++;
    } catch (err) {
      console.error(err);
      toast("データの追加読み込みに失敗しました");
    } finally {
      loading.value = false;
    }
  };

  /** 県を個別に削除 */
  const removePref = (code: string) => {
    loadedPrefs.value = new Set([...loadedPrefs.value].filter((c) => c !== code));
    items.value = items.value.filter((t) => t._pref !== code);
    if (loadedPrefs.value.size === 0) {
      prefCode.value = null;
      try { localStorage.removeItem("touge.pref"); } catch { /* ignore */ }
    } else {
      const first = [...loadedPrefs.value][0];
      prefCode.value = first;
      try { localStorage.setItem("touge.pref", first); } catch { /* ignore */ }
    }
    fitBoundsOnLoad.value = false;
    loadSeq.value++;
  };

  /** 全県クリア */
  const clearAllPrefs = () => {
    loadedPrefs.value = new Set();
    items.value = [];
    prefCode.value = null;
    try { localStorage.removeItem("touge.pref"); } catch { /* ignore */ }
    fitBoundsOnLoad.value = false;
    loadSeq.value++;
  };

  const switchPref = async (code: string, replace = true) => {
    if (!code || !PREFECTURES[code]) return;
    prefCode.value = code;
    persist("touge.pref", code);
    visibleCount.value = PAGE_N;
    searchQuery.value = "";
    select(null);
    if (replace) {
      loadedPrefs.value = new Set([code]);
    } else {
      loadedPrefs.value = new Set([...loadedPrefs.value, code]);
    }
    loading.value = true;
    loadingText.value = `${PREFECTURES[code]}のデータを読み込み中…`;
    try {
      const newItems = await dataLoader.loadPref(code);
      if (prefCode.value !== code) return;
      if (replace) {
        items.value = newItems;
      } else {
        const seen = new Set(items.value.map((t) => t.id));
        items.value = [...items.value, ...newItems.filter((t) => !seen.has(t.id))];
      }
      fitBoundsOnLoad.value = true;
      loadSeq.value++;
      if (isMobile()) sheetState.value = "half";
    } catch (err) {
      console.error(err);
      toast(`${PREFECTURES[code]}のデータを読み込めませんでした`);
      if (replace) items.value = [];
    } finally {
      if (prefCode.value === code) loading.value = false;
    }
  };

  return {
    prefCode,
    preset,
    items,
    searchQuery,
    visibleCount,
    selection,
    loading,
    loadingText,
    loadSeq,
    fitBoundsOnLoad,
    sheetState,
    sidebarHidden,
    overlay3dTarget,
    widthFilter,
    distanceFilter,
    userLatLng,
    loadedPrefs,
    ranked,
    hasQuery,
    visibleCards,
    moreRemaining,
    resultCountLabel,
    prefLabel,
    selectedId,
    selected,
    select,
    revealAndSelect,
    setPreset,
    showMore,
    setSheet,
    toggleSidebar,
    open3D,
    close3D,
    loadAdjacentForNearby,
    addPrefs,
    removePref,
    clearAllPrefs,
    switchPref,
  };
});
