<script setup lang="ts">
// 地図のオーケストレーション: レイヤー構築・ランキング描画・選択への追従・カメラ演出。
import maplibregl from "maplibre-gl";
import { onMounted, onUnmounted, ref, watch } from "vue";

import MapControls from "@/components/MapControls.vue";
import MapLegend from "@/components/MapLegend.vue";
import ViewRotateControls from "@/components/ViewRotateControls.vue";
import { useGeolocate } from "@/composables/useGeolocate";
import { useMapInstance } from "@/composables/useMapInstance";
import { MARKER_N } from "@/lib/constants";
import { camera, type CameraDirector } from "@/map/camera";
import { kobanLayer } from "@/map/kobanLayer";
import { rangeRings } from "@/map/rangeRings";
import { tougeSource } from "@/map/tougeSource";
import { useTougeStore } from "@/stores/tougeStore";

const store = useTougeStore();
const { locate } = useGeolocate();
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
    return new maplibregl.Marker({ element: el, occludedOpacity: 1 })
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

const resizeHandler = () => map.value?.resize();

onMounted(() => {
  const m = init(container.value!);
  director = camera.createDirector(m);
  m.on("load", () => {
    rangeRings.addLayer(m); // 道路レイヤーより下に描くため先に
    kobanLayer.addLayer(m); // 交番レイヤー（道路より下に配置）
    tougeSource.addLayers(m, (tid) => store.revealAndSelect(tid));
    drawTouges();
  });
  window.addEventListener("resize", resizeHandler);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeHandler);
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
    const doFit = () =>
      m.fitBounds(b, {
        padding: currentPadding(50),
        pitch: 55,
        bearing: -10,
        duration: 1200,
      });
    if (mapReady.value) doFit();
    else m.once("load", doFit);
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

watch(
  () => store.sidebarHidden,
  () => {
    setTimeout(() => map.value?.resize(), 280);
  },
);
</script>

<template>
  <div ref="container" class="map-container"></div>

  <div class="map-float">
    <button class="locate-btn" @click="locate">
      📍<span class="locate-label"> 現在地</span>
    </button>
  </div>

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

.map-float {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1250;
  display: flex;
  gap: 6px;
  align-items: center;
}

.map-float .locate-btn {
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--card);
  color: var(--ink);
  padding: 5px 12px;
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
}

.map-float .locate-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

@media (max-width: 760px) {
  .map-float {
    pointer-events: none;
  }

  .map-float > * {
    pointer-events: auto;
  }

  .map-float .locate-btn {
    padding: 7px 10px;
    margin-left: auto;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
  }

  .map-float .locate-label {
    display: none;
  }
}

@media (max-width: 480px) {
  .locate-btn .locate-label {
    display: none;
  }
}
</style>
