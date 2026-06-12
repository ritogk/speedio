// 現在地取得 → 距離サークル描画 → GSI逆ジオコーダで県判定して峠表示。

import maplibregl from "maplibre-gl";

import { useMapInstance } from "@/composables/useMapInstance";
import { useToast } from "@/composables/useToast";
import { COLORS, PREFECTURES } from "@/lib/constants";
import { rangeRings } from "@/map/rangeRings";
import { useTougeStore } from "@/stores/tougeStore";

interface Geolocate {
  locate(): void;
}

let positionMarker: maplibregl.Marker | null = null;

export const useGeolocate = (): Geolocate => {
  const { map, mapReady } = useMapInstance();
  const { show: toast } = useToast();
  const store = useTougeStore();

  return {
    locate: () => {
      if (!navigator.geolocation) {
        toast("このブラウザは位置情報に対応していません");
        return;
      }
      store.loading = true;
      store.loadingText = "現在地を取得中…";
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const m = map.value;
          if (m) {
            positionMarker?.remove();
            positionMarker = new maplibregl.Marker({ color: COLORS.routeRed })
              .setLngLat([lng, lat])
              .addTo(m);
            if (mapReady.value) rangeRings.draw(m, lat, lng);
            else m.once("load", () => rangeRings.draw(m, lat, lng));
          }
          // 逆ジオコーダのmuniCd（市区町村コード）の先頭2桁が県コード
          let code: string | null = null;
          try {
            const res = await fetch(
              `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lng}`,
            );
            if (res.ok) {
              const data = await res.json();
              const muni = data?.results?.muniCd;
              if (muni) code = String(muni).padStart(5, "0").slice(0, 2);
            }
          } catch (err) {
            console.warn("[峠サーチャー] reverse geocode failed:", err);
          }
          store.loading = false;
          if (code && PREFECTURES[code]) {
            toast(`現在地は${PREFECTURES[code]}。おすすめの峠を表示します`);
            void store.switchPref(code);
          } else {
            map.value?.flyTo({ center: [lng, lat], zoom: 11, duration: 1000 });
            toast(
              "現在地の都道府県を判定できませんでした。県を選ぶと峠を表示します",
            );
          }
        },
        () => {
          store.loading = false;
          toast("位置情報を取得できませんでした");
        },
      );
    },
  };
};
