<script setup lang="ts">
// 地図左上のコントロール（3D地形トグル）。
import { ref } from "vue";

import { useMapInstance } from "@/composables/useMapInstance";
import { mapStyle } from "@/map/mapStyle";

const { map } = useMapInstance();

const terrainOn = ref(true);
const toggleTerrain = () => {
  const m = map.value;
  if (!m) return;
  terrainOn.value = !terrainOn.value;
  m.setTerrain(terrainOn.value ? mapStyle.terrain : null);
  if (terrainOn.value && m.getPitch() < 10) {
    m.easeTo({ pitch: 55, duration: 600 });
  }
};

/* DISABLED: 交番レイヤー
const kobanVisible = ref(false);
const kobanLoading = ref(false);

const fetchKoban = async () => {
  const m = map.value;
  const code = store.prefCode;
  if (!m || !code) return;
  kobanLoading.value = true;
  try {
    await kobanLayer.fetchAndShow(m, code);
  } catch {
    toast("交番データの取得に失敗しました");
  } finally {
    kobanLoading.value = false;
  }
};

const toggleKoban = () => {
  const m = map.value;
  if (!m) return;
  kobanVisible.value = !kobanVisible.value;
  kobanLayer.toggle(m, kobanVisible.value);
  if (kobanVisible.value && store.prefCode) {
    void fetchKoban();
  }
};

watch(
  () => store.loadSeq,
  () => {
    if (kobanVisible.value && store.prefCode) {
      void fetchKoban();
    }
  },
);
*/
</script>

<template>
  <div class="map-ctrl">
    <button class="ctrl-btn" :aria-pressed="terrainOn" @click="toggleTerrain">
      ⛰ 3D地形
    </button>
    <!-- DISABLED: 交番トグル
    <button
      class="ctrl-btn"
      :aria-pressed="String(kobanVisible)"
      @click="toggleKoban"
    >
      👮<span v-if="kobanLoading" class="ctrl-spin" />
    </button>
    -->
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

.ctrl-spin {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;
  margin-left: 4px;
  vertical-align: -1px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (min-width: 761px) {
  .map-ctrl {
    left: 10px;
  }
}
</style>
