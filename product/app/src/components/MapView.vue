<script setup lang="ts">
// 地図のオーケストレーション: レイヤー構築・ランキング描画・選択への追従・カメラ演出。
import maplibregl from "maplibre-gl";
import { onMounted, onUnmounted, ref, watch } from "vue";

import GhostLineOverlay from "@/components/GhostLineOverlay.vue";
import MapControls from "@/components/MapControls.vue";
import MapLegend from "@/components/MapLegend.vue";
import ViewRotateControls from "@/components/ViewRotateControls.vue";
import { useMapInstance } from "@/composables/useMapInstance";
import { MARKER_N } from "@/lib/constants";
import { camera, type CameraDirector } from "@/map/camera";
import { rangeRings } from "@/map/rangeRings";
import { tougeSource } from "@/map/tougeSource";
import { useTougeStore } from "@/stores/tougeStore";

const store = useTougeStore();
const { map, mapReady, init, dispose } = useMapInstance();

const container = ref<HTMLElement | null>(null);
let director: CameraDirector | null = null;
let rankMarkers: maplibregl.Marker[] = [];

const currentPadding = (extra: number) => {
  return camera.viewPadding(extra, {
    sheetHalf: store.sheetState === "half",
    sidebarHidden: store.sidebarHidden,
  });
};

const drawRankMarkers = () => {
  const m = map.value;
  if (!m) return;
  rankMarkers.forEach((mk) => mk.remove());
  rankMarkers = store.ranked.slice(0, MARKER_N).map((t, i) => {
    const el = document.createElement("div");
    el.className = "rank-marker";
    el.textContent = String(i + 1);
    el.addEventListener("click", () => store.revealAndSelect(t.id));
    return new maplibregl.Marker({ element: el })
      .setLngLat([t.center[1], t.center[0]])
      .addTo(m);
  });
};

const drawTouges = () => {
  const m = map.value;
  if (!m || !mapReady.value) return;
  tougeSource.setData(m, tougeSource.buildGeoJSON(store.ranked));
  drawRankMarkers();
};

onMounted(() => {
  const m = init(container.value!);
  director = camera.createDirector(m);
  m.on("load", () => {
    rangeRings.addLayer(m); // 道路レイヤーより下に描くため先に
    tougeSource.addLayers(m, (tid) => store.revealAndSelect(tid));
    drawTouges();
  });
});

onUnmounted(() => {
  director?.dispose();
  director = null;
  rankMarkers.forEach((mk) => mk.remove());
  rankMarkers = [];
  dispose();
});

watch(() => store.ranked, drawTouges);

// 県データ読み込み完了時は県全体が収まるようにカメラを引く
watch(
  () => store.loadSeq,
  () => {
    const m = map.value;
    if (!m || !store.ranked.length) return;
    director?.cancelOrbit();
    const b = new maplibregl.LngLatBounds();
    store.ranked.forEach((t) => b.extend([t.center[1], t.center[0]]));
    m.fitBounds(b, {
      padding: currentPadding(50),
      pitch: 55,
      bearing: -10,
      duration: 1200,
    });
  },
);

watch(
  () => store.selection,
  (sel) => {
    const m = map.value;
    if (!m || !mapReady.value) return;
    tougeSource.setHighlight(m, sel.id);
    const t = store.selected;
    if (t && sel.id != null) director?.flyToTouge(t, currentPadding(0));
  },
);
</script>

<template>
  <div ref="container" class="map-container"></div>
  <GhostLineOverlay />
  <MapControls />
  <ViewRotateControls />
  <MapLegend />
</template>

<style scoped>
.map-container {
  position: absolute;
  inset: 0;
  background: var(--paper-deep);
}
</style>
