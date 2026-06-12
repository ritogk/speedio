<script setup lang="ts">
// ランキングカード一覧とページネーション。
import TougeCard from "@/components/TougeCard.vue";
import { PAGE_N } from "@/lib/constants";
import { useTougeStore } from "@/stores/tougeStore";

const store = useTougeStore();
</script>

<template>
  <div class="cards">
    <p v-if="store.hasQuery && !store.visibleCards.length" class="no-hit">
      「{{ store.searchQuery }}」に一致する峠はありません
    </p>
    <TougeCard
      v-for="{ t, rank } in store.visibleCards"
      :key="t.id"
      :touge="t"
      :rank="rank"
    />
    <button
      v-if="store.moreRemaining > 0"
      class="more-btn"
      @click="store.showMore()"
    >
      さらに{{ Math.min(PAGE_N, store.moreRemaining) }}件表示（残り{{
        store.moreRemaining
      }}件）
    </button>
  </div>
</template>

<style scoped>
.no-hit {
  font-size: 12px;
  color: var(--ink-soft);
  padding: 10px 0;
}

.more-btn {
  display: block;
  width: 100%;
  margin: 4px 0 8px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px dashed var(--contour);
  border-radius: var(--radius);
  background: transparent;
  padding: 10px;
  color: var(--ink-soft);
}

.more-btn:hover {
  border-style: solid;
  color: var(--accent);
  border-color: var(--accent);
}
</style>
