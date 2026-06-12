<script setup lang="ts">
// 選択中の峠の全経路をSVG破線で重ねるオーバーレイ（地形ラインは山の陰に隠れるため）。
// 毎フレーム発火するrenderイベントからVueを通さずSVGのattrを直接更新する。
import { ref, watch } from "vue";

import { useMapInstance } from "@/composables/useMapInstance";
import { geo } from "@/lib/geo";
import { useTougeStore } from "@/stores/tougeStore";
import type { LatLng } from "@/types/touge";

const store = useTougeStore();
const { map } = useMapInstance();

const pathEl = ref<SVGPathElement | null>(null);
let ghostPoly: LatLng[] | null = null;

const drawGhost = () => {
  const p = pathEl.value;
  const m = map.value;
  if (!p) return;
  if (!ghostPoly || !m) {
    p.setAttribute("d", "");
    return;
  }
  let d = "";
  for (let i = 0; i < ghostPoly.length; i++) {
    const pt = m.project([ghostPoly[i][1], ghostPoly[i][0]]);
    d += (i ? "L" : "M") + pt.x.toFixed(1) + " " + pt.y.toFixed(1);
  }
  p.setAttribute("d", d);
};

watch(
  () => store.selected,
  (t) => {
    ghostPoly = t && t.poly.length > 1 ? geo.decimate(t.poly, 240) : null;
    drawGhost();
  },
);

watch(
  map,
  (m, _prev, onCleanup) => {
    if (!m) return;
    m.on("render", drawGhost);
    onCleanup(() => m.off("render", drawGhost));
  },
  { immediate: true },
);
</script>

<template>
  <svg class="ghost-line" aria-hidden="true">
    <path ref="pathEl" />
  </svg>
</template>

<style scoped>
.ghost-line {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1050;
}

.ghost-line path {
  fill: none;
  stroke: var(--route-red);
  stroke-width: 3;
  stroke-opacity: 0.35;
  stroke-dasharray: 7 6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
