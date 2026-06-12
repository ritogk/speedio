<script setup lang="ts">
// 評価プリセットの切り替えチップ。
import { PRESET_HINTS, PRESET_LABELS } from "@/lib/constants";
import { useTougeStore } from "@/stores/tougeStore";
import type { PresetKey } from "@/types/touge";

const store = useTougeStore();
const presets = Object.keys(PRESET_LABELS) as PresetKey[];
</script>

<template>
  <section class="presets">
    <div class="chip-row" role="group" aria-label="評価プリセット">
      <button
        v-for="p in presets"
        :key="p"
        class="chip"
        :aria-pressed="store.preset === p"
        @click="store.setPreset(p)"
      >
        {{ PRESET_LABELS[p] }}
      </button>
    </div>
    <p class="preset-hint">{{ PRESET_HINTS[store.preset] }}</p>
  </section>
</template>

<style scoped>
.presets {
  padding: 4px 0 10px;
  border-bottom: 1px dashed var(--contour);
  margin-bottom: 10px;
}

.chip-row {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.chip-row::-webkit-scrollbar {
  display: none;
}

.chip {
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--card);
  color: var(--ink);
  padding: 5px 12px;
  flex-shrink: 0;
}

.chip[aria-pressed="true"] {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.preset-hint {
  font-size: 11px;
  color: var(--ink-soft);
  margin-top: 7px;
  line-height: 1.5;
}

@media (min-width: 761px) {
  .chip-row {
    flex-wrap: wrap;
    overflow-x: visible;
  }
}
</style>
