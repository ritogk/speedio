<script setup lang="ts">
// ランキングパネル（PC: サイドバー / モバイル: 3段階ボトムシート）。検索・プリセット・カード一覧を持つ。
import { nextTick, onMounted, onUnmounted, provide, ref, watch } from "vue";

import PresetChips from "@/components/PresetChips.vue";
import TougeCardList from "@/components/TougeCardList.vue";
import { MOBILE_MAX_WIDTH } from "@/lib/constants";
import { panelBodyKey } from "@/lib/injectionKeys";
import { useTougeStore, type SheetState } from "@/stores/tougeStore";

const store = useTougeStore();

const panelEl = ref<HTMLElement | null>(null);
const sheetHandleEl = ref<HTMLElement | null>(null);
const cardPeekTransform = ref<string | undefined>(undefined);

const panelBody = ref<HTMLElement | null>(null);
provide(panelBodyKey, panelBody);

const isMobile = () => window.innerWidth <= MOBILE_MAX_WIDTH;

const cycleSheet = () => {
  if (!isMobile()) return;
  const s = store.sheetState;
  const next =
    s === "peek" || s === "card-peek"
      ? "half"
      : s === "half"
        ? "full"
        : "peek";
  store.setSheet(next);
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
    const ORDER: SheetState[] = ["peek", "half", "full"];
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

// card-peek 状態: ハンドル＋選択カードの高さを測ってパネルを持ち上げる
watch(
  () => store.selection,
  async (sel) => {
    if (sel.source !== "card" || sel.id == null) return;
    await nextTick();
    const body = panelBody.value;
    const card = body?.querySelector<HTMLElement>(`.card[data-id="${sel.id}"]`);
    const handle = sheetHandleEl.value;
    if (!card || !handle || !isMobile()) return;
    const h = handle.offsetHeight + card.offsetHeight + 14;
    cardPeekTransform.value = `translateY(calc(100% - ${h}px))`;
    document.documentElement.style.setProperty("--card-peek-h", String(h));
  },
);

// card-peek 以外の状態ではインラインtransformをクリアする
watch(
  () => store.sheetState,
  (state) => {
    if (state !== "card-peek") {
      cardPeekTransform.value = undefined;
    }
  },
);

// PC パネルのマウスドラッグスクロール
let dragging = false;
let startY = 0;
let startScroll = 0;
let moved = false;

const onMouseDown = (e: MouseEvent) => {
  if (!isMobile() && e.button === 0) {
    dragging = true;
    moved = false;
    startY = e.clientY;
    startScroll = panelBody.value?.scrollTop ?? 0;
    if (panelBody.value) panelBody.value.style.cursor = "grab";
  }
};

const onMouseMove = (e: MouseEvent) => {
  if (!dragging) return;
  const dy = e.clientY - startY;
  if (Math.abs(dy) > 4) moved = true;
  if (moved && panelBody.value) {
    panelBody.value.scrollTop = startScroll - dy;
    panelBody.value.style.cursor = "grabbing";
  }
};

const onMouseUp = () => {
  if (!dragging) return;
  dragging = false;
  if (panelBody.value) panelBody.value.style.cursor = "";
};

const onBodyClick = (e: MouseEvent) => {
  if (moved) e.stopPropagation();
  moved = false;
};

onMounted(() => {
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
});

onUnmounted(() => {
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
});
</script>

<template>
  <section
    ref="panelEl"
    class="panel"
    :class="[store.sheetState, { 'hidden-side': store.sidebarHidden }]"
    :style="cardPeekTransform ? { transform: cardPeekTransform } : {}"
    aria-label="峠ランキング"
  >
    <div class="side-handle" @click="store.toggleSidebar()">
      <span
        class="chevron"
        :style="store.sidebarHidden ? 'transform:scaleX(-1)' : ''"
        >&#9666;</span
      >
    </div>
    <div
      ref="sheetHandleEl"
      class="sheet-handle"
      @click="cycleSheet"
      @touchstart.passive="onTouchStart"
      @touchend="onTouchEnd"
    >
      <div class="grip"></div>
      <div class="sheet-head">
        <div class="panel-logo">峠</div>
        <span class="count">{{ store.resultCountLabel }}</span>
        <span class="pref-name">{{ store.prefLabel }}</span>
      </div>
    </div>
    <div
      ref="panelBody"
      class="panel-body"
      @mousedown="onMouseDown"
      @click.capture="onBodyClick"
    >
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

.panel.card-peek {
  /* transform set via inline style from store */
}

.panel.full {
  transform: translateY(0);
}

.side-handle {
  display: none;
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

.panel-logo {
  display: none;
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  color: #fff;
  background: var(--accent);
  padding: 6px 7px;
  border-radius: 3px;
  flex-shrink: 0;
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

  .panel-logo {
    display: inline-block;
  }

  .sheet-handle {
    cursor: default;
  }

  .sheet-handle .grip {
    display: none;
  }

  .side-handle {
    display: flex;
    position: absolute;
    right: -22px;
    top: 50%;
    transform: translateY(-50%);
    width: 22px;
    height: 56px;
    align-items: center;
    justify-content: center;
    background: var(--paper);
    border: 1px solid var(--line);
    border-left: none;
    border-radius: 0 6px 6px 0;
    cursor: pointer;
    color: var(--ink-soft);
    font-size: 13px;
    box-shadow: 2px 0 4px rgba(0, 0, 0, 0.08);
    z-index: 1;
  }

  .side-handle:hover {
    color: var(--ink);
    background: var(--paper-deep);
  }
}
</style>
