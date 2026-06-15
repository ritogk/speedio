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

const cornerPct = computed(
  () => props.touge.pctStrong + props.touge.pctMedium + props.touge.pctWeak,
);

const onSelect = () => {
  store.select(props.touge.id, "card");
};

const has3DData =
  props.touge.poly.length >= 2 &&
  props.touge.elevationSmooth.length >= 2;

const open3D = () => {
  store.open3D(props.touge);
};
</script>

<template>
  <article
    class="card"
    :class="{ active: store.selectedId === touge.id }"
    :data-id="touge.id"
    tabindex="0"
    @click="onSelect"
    @keydown.enter="onSelect"
  >
    <div class="card-top">
      <span class="rank-num">{{ rank + 1 }}</span>
      <span class="route-oval">{{ touge.routeLabel }}</span>
      <span v-if="touge.distanceKm != null" class="dist-tag">
        📍{{ touge.distanceKm < 10 ? touge.distanceKm.toFixed(1) : Math.round(touge.distanceKm) }}km
      </span>
      <h3 :data-full="touge.name">{{ touge.name }}</h3>
    </div>
    <p class="meta">
      全長 <b>{{ touge.lengthKm }}km</b> ・ 標高差 <b>{{ touge.height }}m</b>
    </p>
    <div class="bars">
      <span class="bl">コーナー</span>
      <div class="stacked">
        <span :style="{ width: `${touge.pctStrong}%`, background: 'var(--corner-strong)' }"></span>
        <span :style="{ width: `${touge.pctMedium}%`, background: 'var(--corner-medium)' }"></span>
        <span :style="{ width: `${touge.pctWeak}%`, background: 'var(--corner-weak)' }"></span>
        <span :style="{ width: `${touge.pctStraight}%`, background: 'var(--straight)' }"></span>
      </div>
      <span class="bv">{{ cornerPct }}%</span>
      <span class="bl">高低差</span>
      <div class="track">
        <div class="fill" :style="{ width: `${pct(touge.updown)}%` }"></div>
      </div>
      <span class="bv">{{ pct(touge.updown) }}</span>
    </div>
    <div class="card-tags">
      <span v-if="touge.unevennessCount != null" class="card-tag">
        <svg class="bump-ico" viewBox="0 0 20 18"><path d="M0 9Q5 1 10 9Q15 17 20 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        {{ touge.unevennessCount > 0 ? `×${touge.unevennessCount}` : 'なし' }}
      </span>
      <span v-if="touge.buildingCnt != null" class="card-tag">🏠 {{ touge.buildingCnt > 0 ? `×${touge.buildingCnt}` : 'なし' }}</span>
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
        👁 路面
      </a>
      <button
        v-if="has3DData"
        class="btn"
        @click.stop="open3D"
      >
        <svg style="width:14px;height:14px;vertical-align:-2px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L2 9l10 6 10-6-10-6z"/><path d="M2 15l10 6 10-6"/><path d="M2 9v6"/><path d="M22 9v6"/></svg> 3D
      </button>
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
  padding: 11px 104px 11px 12px;
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
  background: #FEF2F2;
}

.rank-num {
  font-size: 11px;
  font-weight: 600;
  color: var(--ink-soft);
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--paper-deep);
  border: 1.5px solid var(--contour);
  display: flex;
  align-items: center;
  justify-content: center;
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
  flex-basis: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  position: relative;
}

.card-top h3::after {
  content: attr(data-full);
  display: none;
  position: absolute;
  left: 0;
  top: calc(100% + 4px);
  z-index: 10;
  background: var(--ink);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  padding: 6px 10px;
  border-radius: 6px;
  white-space: normal;
  max-width: 280px;
  width: max-content;
  line-height: 1.5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}

.card-top h3:hover::after {
  display: block;
}

.dist-tag {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  margin-left: auto;
  white-space: nowrap;
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

.stacked {
  display: flex;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--paper-deep);
}

.stacked span {
  height: 100%;
}

.card-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
  align-items: center;
}

.card-tag {
  font-size: 10px;
  color: var(--ink-soft);
  background: var(--paper-deep);
  border-radius: 4px;
  padding: 2px 7px;
}

.bump-ico {
  width: 14px;
  height: 10px;
  vertical-align: -1px;
}

.card-tag b {
  color: var(--ink);
  font-weight: 500;
}

.card-actions {
  display: flex;
  gap: 5px;
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
