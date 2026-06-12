// MapLibreインスタンスの生成と共有（単一マップ前提）。
// 深いリアクティブ化はMapLibre内部を壊すため必ずshallowRefで保持する。

import maplibregl from "maplibre-gl";
import { readonly, ref, shallowRef, type Ref, type ShallowRef } from "vue";

import { mapStyle } from "@/map/mapStyle";

interface MapInstance {
  map: ShallowRef<maplibregl.Map | null>;
  mapReady: Readonly<Ref<boolean>>;
  init(container: HTMLElement): maplibregl.Map;
  dispose(): void;
}

const map = shallowRef<maplibregl.Map | null>(null);
const mapReady = ref(false);

export const useMapInstance = (): MapInstance => ({
  map,
  mapReady: readonly(mapReady),

  init: (container) => {
    const m = new maplibregl.Map({
      container,
      style: mapStyle.build(),
      ...mapStyle.initialView,
      attributionControl: { compact: true },
    });
    map.value = m;
    m.on("load", () => {
      mapReady.value = true;
    });
    return m;
  },

  dispose: () => {
    map.value?.remove();
    map.value = null;
    mapReady.value = false;
  },
});
