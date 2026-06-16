// 現在地取得 → 距離サークル描画 → GSI逆ジオコーダで県判定して峠表示。

import maplibregl from "maplibre-gl";

import { useMapInstance } from "@/composables/useMapInstance";
import { useToast } from "@/composables/useToast";
import { ADJACENT, COLORS, PREFECTURES } from "@/lib/constants";
import { rangeRings } from "@/map/rangeRings";
import { useTougeStore } from "@/stores/tougeStore";

interface Geolocate {
  locate(onSuccess?: () => void): void;
  locatingBusy: boolean;
}

let positionMarker: maplibregl.Marker | null = null;

export const useGeolocate = (): Geolocate => {
  const { map, mapReady } = useMapInstance();
  const { show: toast } = useToast();
  const store = useTougeStore();

  const state: Geolocate = {
    locatingBusy: false,
    locate: (onSuccess?: () => void) => {
      if (!navigator.geolocation) {
        toast("このブラウザは位置情報に対応していません");
        return;
      }
      if (state.locatingBusy) return;
      state.locatingBusy = true;
      store.loading = true;
      store.loadingText = "現在地を取得中…";
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          store.userLatLng = [lat, lng];
          const m = map.value;
          if (m) {
            positionMarker?.remove();
            positionMarker = new maplibregl.Marker({ color: COLORS.routeRed, occludedOpacity: 1 })
              .setLngLat([lng, lat])
              .addTo(m);
            if (mapReady.value) rangeRings.draw(m, lat, lng);
            else m.once("load", () => rangeRings.draw(m, lat, lng));
          }
          // 逆ジオコーダのmuniCd（市区町村コード）の先頭2桁が県コード
          let code: string | null = null;
          try {
            const ac = new AbortController();
            const tid = setTimeout(() => ac.abort(), 5000);
            const res = await fetch(
              `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lng}`,
              { signal: ac.signal },
            );
            clearTimeout(tid);
            if (res.ok) {
              const data = await res.json();
              const muni = data?.results?.muniCd;
              if (muni) code = String(muni).padStart(5, "0").slice(0, 2);
            }
          } catch (err) {
            console.warn("[峠サーチャー] reverse geocode failed:", err);
          }
          if (code && PREFECTURES[code]) {
            // 隣接県を追加読み込み（既存データは保持）
            const codes = [code, ...(ADJACENT[code] || [])];
            const newCodes = codes.filter((c) => !store.loadedPrefs.has(c));
            for (const c of codes) store.loadedPrefs.add(c);
            if (newCodes.length) {
              await store.addPrefs(newCodes);
            }
            store.loading = false;
            onSuccess?.();
            toast(`${PREFECTURES[code]}＋周辺${codes.length - 1}県を表示`);
            // fitBounds using ALL items
            if (m && store.ranked.length) {
              const b = new maplibregl.LngLatBounds();
              store.items.forEach((t) => t.poly.forEach((p) => b.extend([p[1], p[0]])));
              if (!b.isEmpty()) {
                const doFit = () =>
                  m.fitBounds(b, {
                    padding: { top: 50, left: 50, right: 50, bottom: 50 },
                    pitch: 55,
                    bearing: -10,
                    duration: 1200,
                  });
                if (mapReady.value) doFit();
                else m.once("load", doFit);
              }
            }
          } else {
            store.loading = false;
            onSuccess?.();
            map.value?.flyTo({ center: [lng, lat], zoom: 11, duration: 1000 });
            toast("現在地の都道府県を判定できませんでした");
          }
          state.locatingBusy = false;
        },
        () => {
          state.locatingBusy = false;
          store.loading = false;
          toast("位置情報を取得できませんでした");
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
      );
    },
  };

  return state;
};
