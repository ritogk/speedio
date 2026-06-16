<script setup lang="ts">
// 並び替えプリセットの切り替えチップ。
import maplibregl from "maplibre-gl";

import { useGeolocate } from "@/composables/useGeolocate";
import { useMapInstance } from "@/composables/useMapInstance";
import { ADJACENT, PREFECTURES, PRESET_HINTS, PRESET_LABELS } from "@/lib/constants";
import { useTougeStore } from "@/stores/tougeStore";
import type { PresetKey } from "@/types/touge";

const store = useTougeStore();
const presets = Object.keys(PRESET_LABELS) as PresetKey[];
const geo = useGeolocate();
const { map, mapReady } = useMapInstance();

const onPresetClick = (p: PresetKey) => {
  if (p === "nearby" && !store.userLatLng) {
    if (geo.locatingBusy) return;
    geo.locate(() => {
      store.setPreset("nearby");
      store.distanceFilter = 50;
    });
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
      const codes = [code, ...(ADJACENT[code] || [])];
      void (async () => {
        store.loadedPrefs = new Set(codes);
        store.loading = true;
        store.loadingText = `周辺${codes.length}県のデータを読み込み中…`;
        await store.loadAdjacentForNearby(code);
        // fitBounds after render for nearby 2nd-press
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
