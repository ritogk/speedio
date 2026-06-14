// アプリの中心状態: 県データ・ランキング・検索・選択・シート開閉。

import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { useToast } from "@/composables/useToast";
import {
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
  const sheetState = ref<SheetState>("peek");
  const sidebarHidden = ref(false);
  /** 3Dオーバーレイで表示中の峠。null なら非表示 */
  const overlay3dTarget = ref<TougeVM | null>(null);
  /** 道幅スコアの下限フィルタ (0-1) */
  const widthFilter = ref<number>(0.85);
  /** 人里離れた道フィルタ (建物密度 <= 2.0棟/km) */
  const seclusionFilter = ref(false);
  /** 登りフィルタ (unevennessCount >= 2) */
  const uphillFilter = ref(false);
  /** 距離フィルタ (km)。null=無制限 */
  const distanceFilter = ref<number | null>(null);
  /** ユーザーの現在位置。null=未取得 */
  const userLatLng = ref<[number, number] | null>(null);

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
    }

    // フィルタ適用
    if (widthFilter.value != null) {
      list = list.filter((t) => t.width >= widthFilter.value);
    }
    if (seclusionFilter.value) {
      list = list.filter(
        (t) => t.buildingDensity != null && t.buildingDensity <= 2.0,
      );
    }
    if (uphillFilter.value) {
      list = list.filter(
        (t) => t.unevennessCount != null && t.unevennessCount >= 2,
      );
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

  const prefLabel = computed(() =>
    prefCode.value
      ? `${PREFECTURES[prefCode.value]} / ${prefCode.value}`
      : "未選択",
  );

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
    persist("touge.preset", p);
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

  const toggleSeclusion = () => {
    seclusionFilter.value = !seclusionFilter.value;
  };

  const toggleUphill = () => {
    uphillFilter.value = !uphillFilter.value;
  };

  const switchPref = async (code: string) => {
    if (!code || !PREFECTURES[code]) return;
    prefCode.value = code;
    persist("touge.pref", code);
    visibleCount.value = PAGE_N;
    searchQuery.value = "";
    select(null);
    loading.value = true;
    loadingText.value = `${PREFECTURES[code]}のデータを読み込み中…`;
    try {
      const data = await dataLoader.loadPref(code);
      if (prefCode.value !== code) return; // 連打時は最後に選んだ県を優先
      items.value = data;
      loadSeq.value++;
      if (isMobile()) sheetState.value = "half";
    } catch (err) {
      console.error(err);
      toast(
        `${PREFECTURES[code]}のデータを読み込めませんでした（targets/${code}/target.slim.json）`,
      );
      items.value = [];
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
    sheetState,
    sidebarHidden,
    overlay3dTarget,
    widthFilter,
    seclusionFilter,
    uphillFilter,
    distanceFilter,
    userLatLng,
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
    toggleSeclusion,
    toggleUphill,
    switchPref,
  };
});
