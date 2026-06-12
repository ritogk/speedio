<script setup lang="ts">
// トースト通知の表示先。
import { useToast } from "@/composables/useToast";

const { message, visible } = useToast();
</script>

<template>
  <div class="toast" :class="{ show: visible }">{{ message }}</div>
</template>

<style scoped>
.toast {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1500;
  background: var(--card);
  border: 1px solid var(--line);
  color: var(--ink);
  font-size: 12px;
  border-radius: 999px;
  padding: 7px 18px;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
  max-width: 90vw;
  text-align: center;
}

.toast.show {
  opacity: 0.95;
}
</style>
