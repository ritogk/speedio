<script setup lang="ts">
// 地図左上のコントロール（サイドバー開閉・3D地形トグル）。
import { ref } from "vue";

import { useMapInstance } from "@/composables/useMapInstance";
import { mapStyle } from "@/map/mapStyle";
import { useTougeStore } from "@/stores/tougeStore";

const store = useTougeStore();
const { map } = useMapInstance();

const terrainOn = ref(true);
const toggleTerrain = () => {
  const m = map.value;
  if (!m) return;
  terrainOn.value = !terrainOn.value;
  m.setTerrain(terrainOn.value ? mapStyle.terrain : null);
  m.easeTo(
    terrainOn.value
      ? { pitch: 55, duration: 600 }
      : { pitch: 0, duration: 600 },
  );
};
</script>

<template>
  <div class="map-ctrl" :class="{ 'sidebar-hidden': store.sidebarHidden }">
    <button class="ctrl-btn side-btn" @click="store.toggleSidebar()">
      ☰ ランキング
    </button>
    <button class="ctrl-btn" :aria-pressed="terrainOn" @click="toggleTerrain">
      ⛰ 3D地形
    </button>
  </div>
</template>

<style scoped>
.map-ctrl {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1250;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.ctrl-btn {
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ink);
  padding: 6px 13px;
}

.ctrl-btn[aria-pressed="true"] {
  background: var(--ink);
  border-color: var(--ink);
  color: #fff;
}

.side-btn {
  display: none;
}

@media (min-width: 761px) {
  .side-btn {
    display: block;
  }

  .map-ctrl {
    left: 362px;
    transition: left 0.25s;
  }

  .map-ctrl.sidebar-hidden {
    left: 10px;
  }
}
</style>
