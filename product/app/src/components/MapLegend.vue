<script setup lang="ts">
// コーナーレベルの色凡例。
import { useTougeStore } from "@/stores/tougeStore";

const store = useTougeStore();

const ITEMS = [
  { varName: "--corner-strong", label: "低速コーナー" },
  { varName: "--corner-medium", label: "中速" },
  { varName: "--corner-weak", label: "高速" },
  { varName: "--straight", label: "ストレート" },
];
</script>

<template>
  <div
    class="legend"
    :class="{
      lifted: store.sheetState === 'half',
      hidden: store.sheetState === 'full',
    }"
  >
    <ul>
      <li v-for="item in ITEMS" :key="item.varName">
        <span
          class="swatch"
          :style="{ background: `var(${item.varName})` }"
        ></span
        >{{ item.label }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.legend {
  position: absolute;
  left: 10px;
  bottom: calc(96px + 10px);
  z-index: 1100;
  font-size: 10px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
  pointer-events: none;
}

.legend li {
  list-style: none;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
}

.legend li:first-child {
  margin-top: 0;
}

.swatch {
  width: 16px;
  height: 4px;
  border-radius: 2px;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

@media (max-width: 760px) {
  .legend {
    transition:
      bottom 0.28s cubic-bezier(0.3, 0.9, 0.3, 1),
      opacity 0.2s;
  }

  .legend.lifted {
    bottom: calc(44dvh + 10px);
  }

  .legend.hidden {
    opacity: 0;
    pointer-events: none;
  }
}

@media (min-width: 761px) {
  .legend {
    left: auto;
    right: 10px;
    bottom: 24px;
  }
}
</style>
