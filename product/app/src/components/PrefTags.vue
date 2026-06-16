<script setup lang="ts">
// 読み込み済み県のタグ表示・追加セレクト・個別削除・全クリア。
import { useToast } from "@/composables/useToast";
import { PREFECTURE_ENTRIES, PREFECTURES } from "@/lib/constants";
import { useTougeStore } from "@/stores/tougeStore";

const store = useTougeStore();
const { show: toast } = useToast();

const sortedPrefs = () =>
  [...store.loadedPrefs].sort().filter((c) => PREFECTURES[c]);

const onPrefChange = (e: Event) => {
  const sel = e.target as HTMLSelectElement;
  const code = sel.value;
  if (!code) return;
  sel.value = "";
  if (store.loadedPrefs.has(code)) {
    toast(`${PREFECTURES[code]}は読み込み済みです`);
    return;
  }
  void store.switchPref(code, store.loadedPrefs.size === 0);
};
</script>

<template>
  <div class="pref-tags">
    <select
      class="pref-select"
      value=""
      aria-label="都道府県を選択"
      @change="onPrefChange"
    >
      <option value="">+ 県を追加</option>
      <option
        v-for="[code, name] in PREFECTURE_ENTRIES"
        :key="code"
        :value="code"
      >
        {{ name }}
      </option>
    </select>
    <span
      v-for="code in sortedPrefs()"
      :key="code"
      class="pref-tag"
    >
      {{ PREFECTURES[code] }}
      <button
        class="pref-tag-x"
        @click.stop="store.removePref(code)"
      >
        ✕
      </button>
    </span>
    <button
      v-if="sortedPrefs().length >= 2"
      class="pref-clear"
      @click="store.clearAllPrefs()"
    >
      全クリア
    </button>
  </div>
</template>

<style scoped>
.pref-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 0 8px;
  align-items: center;
}

.pref-select {
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--card);
  color: var(--ink);
  padding: 5px 28px 5px 12px;
  cursor: pointer;
  appearance: none;
  max-width: 45vw;
  flex-shrink: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%231A1C1F' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}

.pref-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ink);
  background: var(--paper-deep);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 5px 8px 5px 12px;
  white-space: nowrap;
}

.pref-tag-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background: transparent;
  font-size: 13px;
  line-height: 1;
  color: var(--ink-soft);
  cursor: pointer;
  padding: 0;
}

.pref-tag-x:hover {
  background: var(--contour);
  color: var(--ink);
}

.pref-clear {
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-soft);
  cursor: pointer;
  border: 1px dashed var(--contour);
  border-radius: 999px;
  background: transparent;
  padding: 5px 12px;
  white-space: nowrap;
}

.pref-clear:hover {
  color: var(--accent);
  border-color: var(--accent);
}
</style>
