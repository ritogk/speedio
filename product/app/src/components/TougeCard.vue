<script setup lang="ts">
// 峠1件のランキングカード（スコアバー・外部リンク・サムネイル）。
import { computed } from "vue";

import RouteThumb from "@/components/RouteThumb.vue";
import { urls } from "@/lib/urls";
import { useTougeStore } from "@/stores/tougeStore";
import type { RankedTouge } from "@/types/touge";

const props = defineProps<{
  touge: RankedTouge;
  rank: number;
}>();

const store = useTougeStore();

const svUrl = computed(() => urls.streetView(props.touge.poly));
const pct = (v: number) => Math.round(v * 100);

const onSelect = () => {
  store.select(props.touge.id, "card");
};
</script>

<template>
  <article
    class="card"
    :class="{ top1: rank === 0, active: store.selectedId === touge.id }"
    :data-id="touge.id"
    tabindex="0"
    @click="onSelect"
    @keydown.enter="onSelect"
  >
    <div class="rank-badge">{{ rank + 1 }}</div>
    <div class="card-top">
      <span class="route-oval">{{ touge.routeLabel }}</span>
      <h3>{{ touge.name }}</h3>
      <span v-if="rank === 0" class="today-pick">本日の一本</span>
    </div>
    <p class="meta">
      全長 <b>{{ touge.lengthKm }}km</b> ・ 標高差 <b>{{ touge.height }}m</b>
      <template v-if="touge.undulationCnt != null">
        ・ 起伏 <b>{{ touge.undulationCnt }}</b>
      </template>
      ・ 総合 <b>{{ pct(touge.score) }}</b
      >点
    </p>
    <div class="bars">
      <span class="bl">コーナー</span>
      <div class="track">
        <div class="fill" :style="{ width: `${pct(touge.corner)}%` }"></div>
      </div>
      <span class="bv">{{ pct(touge.corner) }}</span>
      <span class="bl">高低差</span>
      <div class="track">
        <div class="fill" :style="{ width: `${pct(touge.updown)}%` }"></div>
      </div>
      <span class="bv">{{ pct(touge.updown) }}</span>
      <span class="bl">道幅</span>
      <div class="track">
        <div class="fill" :style="{ width: `${pct(touge.width)}%` }"></div>
      </div>
      <span class="bv">{{ pct(touge.width) }}</span>
    </div>
    <div class="card-actions">
      <a
        class="btn primary"
        :href="urls.googleMap(touge.poly)"
        target="_blank"
        rel="noopener"
        @click.stop
      >
        🚗 行く
      </a>
      <a
        v-if="svUrl"
        class="btn"
        :href="svUrl"
        target="_blank"
        rel="noopener"
        @click.stop
      >
        📷 路面
      </a>
    </div>
    <RouteThumb :touge="touge" />
  </article>
</template>

<style scoped>
.card {
  position: relative;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 11px 104px 11px 50px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.card:hover {
  border-color: var(--contour);
}

.card.active {
  border-color: var(--accent);
  box-shadow: inset 3px 0 0 var(--accent);
}

.rank-badge {
  position: absolute;
  left: 11px;
  top: 11px;
  font-size: 14px;
  font-weight: 600;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--paper-deep);
  border: 1px solid var(--contour);
  color: var(--ink);
}

.card.top1 .rank-badge {
  background: var(--ink);
  border-color: var(--ink);
  color: #fff;
}

.card-top {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
  flex-wrap: wrap;
}

.route-oval {
  font-size: 10px;
  font-weight: 500;
  color: var(--ink-soft);
  border: 1px solid var(--contour);
  border-radius: 999px;
  padding: 1px 8px;
  white-space: nowrap;
}

.card-top h3 {
  font-size: 14px;
  font-weight: 700;
  word-break: break-all;
}

.today-pick {
  font-size: 9px;
  font-weight: 700;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 4px;
  padding: 1px 5px;
  letter-spacing: 0.08em;
}

.meta {
  font-size: 11px;
  color: var(--ink-soft);
  margin-bottom: 7px;
}

.meta b {
  color: var(--ink);
  font-weight: 500;
}

.bars {
  display: grid;
  grid-template-columns: 58px 1fr 28px;
  gap: 3px 8px;
  align-items: center;
}

.bars .bl {
  font-size: 10px;
  color: var(--ink-soft);
}

.bars .bv {
  font-size: 10px;
  text-align: right;
}

.track {
  height: 6px;
  background: var(--paper-deep);
  border-radius: 3px;
  overflow: hidden;
}

.fill {
  height: 100%;
  background: var(--gauge);
  border-radius: 3px;
}

.card-actions {
  display: flex;
  gap: 6px;
  margin-top: 9px;
}

.btn {
  font: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--paper-deep);
  padding: 5px 10px;
  text-decoration: none;
  color: var(--ink);
}

.btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 700;
}
</style>
