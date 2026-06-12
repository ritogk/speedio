<script setup lang="ts">
// ランキングパネル（PC: サイドバー / モバイル: 3段階ボトムシート）。検索・プリセット・カード一覧を持つ。
import { nextTick, provide, ref, watch } from "vue";

import PresetChips from "@/components/PresetChips.vue";
import TougeCardList from "@/components/TougeCardList.vue";
import { panelBodyKey } from "@/lib/injectionKeys";
import { useTougeStore, type SheetState } from "@/stores/tougeStore";

const store = useTougeStore();

const panelBody = ref<HTMLElement | null>(null);
provide(panelBodyKey, panelBody);

const ORDER: SheetState[] = ["peek", "half", "full"];
const cycleSheet = () => {
  const idx = (ORDER.indexOf(store.sheetState) + 1) % ORDER.length;
  store.setSheet(ORDER[idx]);
};

let dragStartY: number | null = null;
let dragStartState: SheetState = "peek";
const onTouchStart = (e: TouchEvent) => {
  dragStartY = e.touches[0].clientY;
  dragStartState = store.sheetState;
};
const onTouchEnd = (e: TouchEvent) => {
  if (dragStartY === null) return;
  const dy = e.changedTouches[0].clientY - dragStartY;
  if (Math.abs(dy) > 40) {
    const idx = ORDER.indexOf(dragStartState) + (dy < 0 ? 1 : -1);
    store.setSheet(ORDER[Math.max(0, Math.min(2, idx))]);
  }
  dragStartY = null;
};

// 地図側から選択されたら、該当カードまでパネル内部だけをスクロールする
watch(
  () => store.selection,
  async (sel) => {
    if (sel.source !== "map" || sel.id == null) return;
    await nextTick();
    const body = panelBody.value;
    const card = body?.querySelector<HTMLElement>(`.card[data-id="${sel.id}"]`);
    if (!card || !body) return;
    const delta =
      card.getBoundingClientRect().top - body.getBoundingClientRect().top;
    body.scrollTo({ top: body.scrollTop + delta - 8, behavior: "smooth" });
  },
);
</script>

<template>
  <section
    class="panel"
    :class="[store.sheetState, { 'hidden-side': store.sidebarHidden }]"
    aria-label="峠ランキング"
  >
    <div
      class="sheet-handle"
      @click="cycleSheet"
      @touchstart.passive="onTouchStart"
      @touchend="onTouchEnd"
    >
      <div class="grip"></div>
      <div class="sheet-head">
        <h2>この県のおすすめ</h2>
        <span class="count">{{ store.resultCountLabel }}</span>
        <span class="pref-name">{{ store.prefLabel }}</span>
      </div>
    </div>
    <div ref="panelBody" class="panel-body">
      <div class="searchbox">
        <input
          v-model="store.searchQuery"
          type="search"
          placeholder="🔍 峠名・道路種別で検索"
          autocomplete="off"
        />
      </div>
      <PresetChips />
      <TougeCardList />
    </div>
  </section>
</template>

<style scoped>
.panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1200;
  background: var(--paper);
  border-top: 1px solid var(--line);
  border-radius: 14px 14px 0 0;
  display: flex;
  flex-direction: column;
  height: 80dvh;
  transform: translateY(calc(100% - 96px));
  transition: transform 0.28s cubic-bezier(0.3, 0.9, 0.3, 1);
  touch-action: none;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.15);
}

.panel.half {
  transform: translateY(45%);
}

.panel.full {
  transform: translateY(0);
}

.sheet-handle {
  flex-shrink: 0;
  padding: 8px 16px 6px;
  cursor: grab;
  user-select: none;
}

.sheet-handle .grip {
  width: 42px;
  height: 4px;
  border-radius: 2px;
  background: var(--contour);
  margin: 0 auto 8px;
}

.sheet-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.sheet-head h2 {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.sheet-head .count {
  font-size: 11px;
  color: var(--ink-soft);
}

.sheet-head .pref-name {
  margin-left: auto;
  font-size: 11px;
  color: var(--ink-soft);
  letter-spacing: 0.06em;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 4px 14px 24px;
  -webkit-overflow-scrolling: touch;
}

.searchbox {
  padding: 2px 0 8px;
}

.searchbox input {
  width: 100%;
  font: inherit;
  font-size: 13px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
  color: var(--ink);
  padding: 7px 10px;
}

.searchbox input::placeholder {
  color: var(--ink-soft);
}

.searchbox input:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

@media (min-width: 761px) {
  .panel {
    left: 0;
    right: auto;
    top: 0;
    bottom: 0;
    height: auto;
    width: 350px;
    border-radius: 0;
    border-top: 0;
    border-right: 1px solid var(--line);
    transform: none !important;
    transition: margin-left 0.25s;
    box-shadow: none;
  }

  .panel.hidden-side {
    margin-left: -352px;
  }

  .sheet-handle {
    cursor: default;
  }

  .sheet-handle .grip {
    display: none;
  }
}
</style>
