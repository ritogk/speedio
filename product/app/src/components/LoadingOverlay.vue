<script setup lang="ts">
// 全画面ローディング表示。
import { useTougeStore } from "@/stores/tougeStore";

const store = useTougeStore();
</script>

<template>
  <div v-show="store.loading" class="loading-overlay">
    <div class="spinner"></div>
    <p>{{ store.loadingText }}</p>
  </div>
</template>

<style scoped>
.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 1400;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
}

.spinner {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 4px solid var(--contour);
  border-top-color: var(--accent);
  animation: spin 1s linear infinite;
}

p {
  color: #fff;
  font-size: 12px;
}
</style>
