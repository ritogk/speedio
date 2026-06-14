<script setup lang="ts">
// モバイル用の地図回転ボタン。
import { computed, ref } from "vue";

import { useHoldRotate } from "@/composables/useHoldRotate";
import { useTougeStore } from "@/stores/tougeStore";

const store = useTougeStore();
const rotL = ref<HTMLElement | null>(null);
const rotR = ref<HTMLElement | null>(null);
useHoldRotate(rotL, 1); // 地図が左回りに見える方向
useHoldRotate(rotR, -1);

/** card-peek 時は CSS 変数 --card-peek-h に連動して bottom を動かす */
const cardPeekStyle = computed(() => {
  if (store.sheetState !== "card-peek") return {};
  // CSS変数をcalcで参照する
  return { bottom: "calc(var(--card-peek-h, 96) * 1px + 14px)" };
});
</script>

<template>
  <div
    class="view-ctrl"
    :class="{
      lifted: store.sheetState === 'half',
      hidden: store.sheetState === 'full',
    }"
    :style="cardPeekStyle"
  >
    <button ref="rotL" aria-label="左に回転">⟲</button>
    <button ref="rotR" aria-label="右に回転">⟳</button>
  </div>
</template>

<style scoped>
.view-ctrl {
  position: absolute;
  right: 10px;
  bottom: calc(96px + 14px);
  z-index: 1100;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.view-ctrl button {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.92);
  font-size: 18px;
  color: var(--ink);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.view-ctrl button:active {
  background: var(--ink);
  border-color: var(--ink);
  color: #fff;
}

@media (min-width: 761px) {
  .view-ctrl {
    bottom: 24px;
  }
}

/* ボトムシートの開き具合に追従して持ち上げる */
@media (max-width: 760px) {
  .view-ctrl {
    transition:
      bottom 0.28s cubic-bezier(0.3, 0.9, 0.3, 1),
      opacity 0.2s;
  }

  .view-ctrl.lifted {
    bottom: calc(44dvh + 14px);
  }

  .view-ctrl.hidden {
    opacity: 0;
    pointer-events: none;
  }
}
</style>
