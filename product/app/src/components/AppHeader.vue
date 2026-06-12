<script setup lang="ts">
// ヘッダー: ロゴ(LPへ戻る)・都道府県セレクタ・現在地ボタン。
import { useGeolocate } from "@/composables/useGeolocate";
import { PREFECTURE_ENTRIES } from "@/lib/constants";
import { useTougeStore } from "@/stores/tougeStore";

const store = useTougeStore();
const { locate } = useGeolocate();

const lpUrl = import.meta.env.VITE_LP_URL || "/";

const onPrefChange = (e: Event) => {
  void store.switchPref((e.target as HTMLSelectElement).value);
};
</script>

<template>
  <header>
    <a class="logo" :href="lpUrl" aria-label="トップページに戻る">峠</a>
    <h1>峠サーチャー <span class="title-sub">3D</span></h1>
    <select
      class="pref-select"
      :value="store.prefCode ?? ''"
      aria-label="都道府県を選択"
      @change="onPrefChange"
    >
      <option value="">都道府県を選ぶ</option>
      <option
        v-for="[code, name] in PREFECTURE_ENTRIES"
        :key="code"
        :value="code"
      >
        {{ name }}
      </option>
    </select>
    <button class="locate-btn" @click="locate">
      📍<span class="locate-label"> 現在地</span>
    </button>
  </header>
</template>

<style scoped>
header {
  height: var(--header-h);
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 14px;
  background: #fff;
  border-bottom: 1px solid var(--line);
  z-index: 1300;
  flex-shrink: 0;
}

.logo {
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  color: #fff;
  background: var(--accent);
  padding: 6px 7px;
  border-radius: 3px;
  flex-shrink: 0;
  text-decoration: none;
}

h1 {
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.04em;
  white-space: nowrap;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.title-sub {
  font-size: 11px;
  color: var(--ink-soft);
}

.pref-select {
  margin-left: auto;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--card);
  color: var(--ink);
  padding: 5px 28px 5px 14px;
  cursor: pointer;
  appearance: none;
  max-width: 42vw;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%231A1C1F' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 11px center;
}

.locate-btn {
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--card);
  color: var(--ink);
  padding: 5px 12px;
  white-space: nowrap;
  flex-shrink: 0;
}

.locate-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

@media (max-width: 480px) {
  header {
    gap: 7px;
    padding: 0 10px;
  }

  .logo {
    font-size: 17px;
    padding: 4px 6px;
  }

  h1 {
    font-size: 13px;
  }

  .pref-select {
    font-size: 12px;
    padding: 5px 24px 5px 10px;
    max-width: 36vw;
    background-position: right 9px center;
  }

  .locate-btn {
    padding: 5px 9px;
  }

  .locate-btn .locate-label {
    display: none;
  }
}
</style>
