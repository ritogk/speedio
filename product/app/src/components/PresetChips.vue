<script setup lang="ts">
// 並び替えプリセットの切り替えチップ。
import maplibregl from "maplibre-gl";

import { useMapInstance } from "@/composables/useMapInstance";
import { useToast } from "@/composables/useToast";
import { ADJACENT, COLORS, PREFECTURES, PRESET_HINTS, PRESET_LABELS } from "@/lib/constants";
import { rangeRings } from "@/map/rangeRings";
import { useTougeStore } from "@/stores/tougeStore";
import type { PresetKey } from "@/types/touge";

const store = useTougeStore();
const presets = Object.keys(PRESET_LABELS) as PresetKey[];
const { map, mapReady } = useMapInstance();
const { show: toast } = useToast();

let locatingBusy = false;
let positionMarker: maplibregl.Marker | null = null;

/** nearby first-press: 自前の位置取得→逆ジオコーダ→隣接県ロード→fitBounds */
const nearbyFirstPress = () => {
  if (!navigator.geolocation) {
    toast("このブラウザは位置情報に対応していません");
    return;
  }
  if (locatingBusy) return;
  locatingBusy = true;
  store.loading = true;
  store.loadingText = "現在地を取得中…";

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      store.userLatLng = [lat, lng];

      // 現在地マーカーと距離サークル
      const m = map.value;
      if (m) {
        positionMarker?.remove();
        positionMarker = new maplibregl.Marker({ color: COLORS.routeRed, occludedOpacity: 1 })
          .setLngLat([lng, lat])
          .addTo(m);
        if (mapReady.value) rangeRings.draw(m, lat, lng);
        else m.once("load", () => rangeRings.draw(m, lat, lng));
      }

      // preset/filterを先にセット
      store.setPreset("nearby");
      store.distanceFilter = 50;

      // 逆ジオコーダで県判定
      let code: string | null = null;
      try {
        const ac = new AbortController();
        const tid = setTimeout(() => ac.abort(), 5000);
        const res = await fetch(
          `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lng}`,
          { signal: ac.signal },
        );
        clearTimeout(tid);
        if (res.ok) {
          const data = await res.json();
          const muni = data?.results?.muniCd;
          if (muni) code = String(muni).padStart(5, "0").slice(0, 2);
        }
      } catch (err) {
        console.warn("[峠サーチャー] reverse geocode failed:", err);
      }

      if (code && PREFECTURES[code]) {
        const codes = [code, ...(ADJACENT[code] || [])];
        // loadedPrefs をクリアして隣接県だけにする
        await store.loadAdjacentForNearby(code);
        store.loading = false;
        toast(`${PREFECTURES[code]}＋周辺${codes.length - 1}県から50km以内の峠を表示`);

        // fitBounds: 50km以内のランク済みアイテムで
        if (m && store.ranked.length) {
          const b = new maplibregl.LngLatBounds();
          store.ranked
            .filter((t) => t.distanceKm != null && t.distanceKm <= 50)
            .forEach((t) => {
              t.poly.forEach((pt) => b.extend([pt[1], pt[0]]));
            });
          if (!b.isEmpty()) {
            const doFit = () =>
              m.fitBounds(b, {
                padding: { top: 50, left: 50, right: 50, bottom: 50 },
                pitch: 55,
                bearing: -10,
                duration: 1200,
              });
            if (mapReady.value) doFit();
            else m.once("load", doFit);
          }
        }
      } else {
        store.loading = false;
        toast("現在地の都道府県を判定できませんでした");
      }
      locatingBusy = false;
    },
    () => {
      locatingBusy = false;
      store.loading = false;
      toast("位置情報を取得できませんでした");
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
};

const onPresetClick = (p: PresetKey) => {
  if (p === "nearby" && !store.userLatLng) {
    nearbyFirstPress();
    return;
  }
  if (store.preset === p) {
    store.setPreset("balance");
    store.distanceFilter = null;
  } else {
    store.setPreset(p);
    store.distanceFilter = p === "nearby" ? 50 : null;
    if (p === "nearby" && store.userLatLng) {
      const code = [...store.loadedPrefs][0] || store.prefCode;
      if (!code) return;
      void (async () => {
        await store.loadAdjacentForNearby(code);
        store.loading = false;
        // fitBounds: 50km以内のランク済みアイテムで
        const m = map.value;
        if (m && store.ranked.length) {
          const b = new maplibregl.LngLatBounds();
          store.ranked
            .filter((t) => t.distanceKm != null && t.distanceKm <= 50)
            .forEach((t) =>
              t.poly.forEach((pt) => b.extend([pt[1], pt[0]])),
            );
          if (!b.isEmpty()) {
            const doFit = () =>
              m.fitBounds(b, {
                padding: { top: 50, left: 50, right: 50, bottom: 50 },
                pitch: 55,
                bearing: -10,
                duration: 1200,
              });
            if (mapReady.value) doFit();
            else m.once("load", doFit);
          }
        }
      })();
    }
  }
};
</script>

<template>
  <section class="presets">
    <div class="chip-row" role="group" aria-label="並び替え">
      <button
        v-for="p in presets"
        :key="p"
        class="chip"
        :aria-pressed="String(store.preset === p)"
        @click="onPresetClick(p)"
      >
        {{ PRESET_LABELS[p] }}
      </button>
    </div>
    <p class="preset-hint">{{ PRESET_HINTS[store.preset] }}</p>
  </section>
</template>

<style scoped>
.presets {
  padding: 4px 0 10px;
  border-bottom: 1px dashed var(--contour);
  margin-bottom: 10px;
}

.chip-row {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.chip-row::-webkit-scrollbar {
  display: none;
}

.chip {
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--card);
  color: var(--ink);
  padding: 5px 12px;
  flex-shrink: 0;
}

.chip[aria-pressed="true"] {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.preset-hint {
  font-size: 11px;
  color: var(--ink-soft);
  margin-top: 7px;
  line-height: 1.5;
}

@media (min-width: 761px) {
  .chip-row {
    flex-wrap: wrap;
    overflow-x: visible;
  }
}
</style>
