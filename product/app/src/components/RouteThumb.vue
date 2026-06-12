<script setup lang="ts">
// カードのコース図サムネイル。パネル内に見えてから生成する遅延ロード（県全体で数百件あるため）。
import { useIntersectionObserver } from "@vueuse/core";
import { inject, ref } from "vue";

import { useThumb } from "@/composables/useThumb";
import { panelBodyKey } from "@/lib/injectionKeys";
import type { TougeVM } from "@/types/touge";

const props = defineProps<{
  touge: TougeVM;
}>();

const { getThumb } = useThumb();
const el = ref<HTMLElement | null>(null);
const url = ref<string | null>(null);
const failed = ref(false);

const panelBody = inject(panelBodyKey, ref(null));
const { stop } = useIntersectionObserver(
  el,
  (entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    stop();
    const w = (el.value?.clientWidth || 84) * 2;
    const h = (el.value?.clientHeight || 116) * 2;
    void getThumb(props.touge, w, h).then((dataUrl) => {
      if (dataUrl) url.value = dataUrl;
      else failed.value = true;
    });
  },
  { root: panelBody, rootMargin: "300px" },
);
</script>

<template>
  <div ref="el" class="thumb">
    <img v-if="url" :src="url" alt="コース形状" />
    <template v-else-if="failed">—</template>
    <span v-else class="thumb-spin"></span>
  </div>
</template>

<style scoped>
.thumb {
  position: absolute;
  right: 10px;
  top: 10px;
  bottom: 10px;
  width: 84px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--paper-deep);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--contour);
  font-size: 18px;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumb-spin {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  animation: spin 1s linear infinite;
}
</style>
