// 交番レイヤー（Overpass APIから交番データを取得し絵文字アイコンで表示）。

import maplibregl, {
  type GeoJSONSource,
  type Map as MaplibreMap,
} from "maplibre-gl";

import { PREFECTURES } from "@/lib/constants";

interface KobanFeature {
  type: "Feature";
  properties: { name: string };
  geometry: { type: "Point"; coordinates: [number, number] };
}

interface KobanGeoJSON {
  type: "FeatureCollection";
  features: KobanFeature[];
}

interface KobanLayer {
  addLayer(map: MaplibreMap): void;
  toggle(map: MaplibreMap, visible: boolean): void;
  fetchAndShow(map: MaplibreMap, prefCode: string): Promise<void>;
  readonly loading: boolean;
}

const SOURCE = "koban-src";
const LAYER = "koban-layer";
const EMPTY: KobanGeoJSON = { type: "FeatureCollection", features: [] };

const createKobanLayer = (): KobanLayer => {
  const cache: Record<string, KobanGeoJSON> = {};
  let isLoading = false;

  return {
    get loading() {
      return isLoading;
    },

    addLayer: (map) => {
      // Canvas-based emoji icon
      const sz = 32;
      const cv = document.createElement("canvas");
      cv.width = cv.height = sz;
      const cx = cv.getContext("2d")!;
      cx.font = `${sz - 4}px serif`;
      cx.textAlign = "center";
      cx.textBaseline = "middle";
      cx.fillText("\u{1F46E}", sz / 2, sz / 2 + 1);
      map.addImage("koban-ico", {
        width: sz,
        height: sz,
        data: new Uint8Array(cx.getImageData(0, 0, sz, sz).data),
      });

      map.addSource(SOURCE, { type: "geojson", data: EMPTY });
      map.addLayer({
        id: LAYER,
        type: "symbol",
        source: SOURCE,
        layout: {
          "icon-image": "koban-ico",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 8, 0.4, 14, 0.7],
          "icon-allow-overlap": false,
          "icon-optional": true,
          visibility: "none",
        },
      });

      // Click popup
      map.on("click", LAYER, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const name = (f.properties?.name as string) || "交番";
        new maplibregl.Popup({
          offset: 8,
          closeButton: false,
          maxWidth: "200px",
        })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-size:12px;font-weight:500">${escapeHtml(name)}</div>`,
          )
          .addTo(map);
      });

      map.on("mouseenter", LAYER, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", LAYER, () => {
        map.getCanvas().style.cursor = "";
      });
    },

    toggle: (map, visible) => {
      if (map.getLayer(LAYER)) {
        map.setLayoutProperty(LAYER, "visibility", visible ? "visible" : "none");
      }
      if (!visible) {
        (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(EMPTY);
      }
    },

    fetchAndShow: async (map, prefCode) => {
      const name = PREFECTURES[prefCode];
      if (!name) return;

      // Use cache if available
      if (cache[prefCode]) {
        (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(
          cache[prefCode],
        );
        return;
      }

      isLoading = true;
      const query = `[out:json][timeout:30];area["name"="${name}"]["admin_level"="4"]->.pref;(node["amenity"="police"](area.pref);way["amenity"="police"](area.pref););out center;`;
      try {
        const res = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: "data=" + encodeURIComponent(query),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const features: KobanFeature[] = (
          data.elements as {
            lat?: number;
            lon?: number;
            center?: { lat: number; lon: number };
            tags?: { name?: string };
          }[]
        )
          .map((el) => {
            const lat = el.lat ?? el.center?.lat;
            const lon = el.lon ?? el.center?.lon;
            if (lat == null || lon == null) return null;
            return {
              type: "Feature" as const,
              properties: { name: el.tags?.name || "" },
              geometry: {
                type: "Point" as const,
                coordinates: [lon, lat] as [number, number],
              },
            };
          })
          .filter((f): f is KobanFeature => f !== null);

        const geojson: KobanGeoJSON = { type: "FeatureCollection", features };
        cache[prefCode] = geojson;
        (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(geojson);
      } catch (err) {
        console.warn("[交番]", (err as Error).message);
        throw err;
      } finally {
        isLoading = false;
      }
    },
  };
};

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const kobanLayer = createKobanLayer();
