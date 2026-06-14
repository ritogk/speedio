<script setup lang="ts">
// レイアウトの殻。iOSのピンチ拡大とページスクロールの抑止もここで行う。
import { onMounted, onUnmounted } from "vue";

import LoadingOverlay from "@/components/LoadingOverlay.vue";
import MapView from "@/components/MapView.vue";
import Overlay3D from "@/components/Overlay3D.vue";
import RankingPanel from "@/components/RankingPanel.vue";
import ToastHost from "@/components/ToastHost.vue";
import { useUrlState } from "@/composables/useUrlState";
import { useTougeStore } from "@/stores/tougeStore";

useUrlState();
const store = useTougeStore();

const onGestureStart = (e: Event) => e.preventDefault();
const onDblClick = (e: MouseEvent) => {
  if (!(e.target as HTMLElement).closest(".map-container")) e.preventDefault();
};
const onScroll = () => {
  if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
};

onMounted(() => {
  document.addEventListener("gesturestart", onGestureStart);
  document.addEventListener("dblclick", onDblClick);
  window.addEventListener("scroll", onScroll);
});
onUnmounted(() => {
  document.removeEventListener("gesturestart", onGestureStart);
  document.removeEventListener("dblclick", onDblClick);
  window.removeEventListener("scroll", onScroll);
});
</script>

<template>
  <div class="app">
    <main>
      <div
        class="map-area"
        :class="{ 'sidebar-hidden': store.sidebarHidden }"
      >
        <MapView />
      </div>
      <RankingPanel />
      <LoadingOverlay />
      <ToastHost />
      <Overlay3D />
    </main>
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
}

main {
  flex: 1;
  position: relative;
  min-height: 0;
}

.map-area {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

@media (min-width: 761px) {
  .map-area {
    left: 351px;
    transition: left 0.25s;
  }

  .map-area.sidebar-hidden {
    left: 0;
  }
}
</style>
