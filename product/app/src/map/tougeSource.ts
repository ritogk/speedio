// 峠の道路レイヤー（コーナー色分け・選択グロー・クリック選択）の管理。

import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";

import { COLORS } from "@/lib/constants";
import { geo } from "@/lib/geo";
import type { RankedTouge } from "@/types/touge";

interface TougeFeature {
  type: "Feature";
  properties: { level: string; fade: number; tid: number };
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

export interface TougeFeatureCollection {
  type: "FeatureCollection";
  features: TougeFeature[];
}

interface TougeSource {
  buildGeoJSON(list: RankedTouge[]): TougeFeatureCollection;
  addLayers(map: MaplibreMap, onSelect: (tid: number) => void): void;
  setData(map: MaplibreMap, geojson: TougeFeatureCollection): void;
  setHighlight(map: MaplibreMap, id: number | null): void;
}

const SOURCE = "touge";
const NO_SELECTION = -9999;

export const tougeSource: TougeSource = {
  buildGeoJSON: (list) => {
    const features: TougeFeature[] = [];
    list.forEach((t, i) => {
      const fade = geo.fadeOf(i, list.length, 0.25);
      if (t.roadSection.length) {
        for (const sec of t.roadSection) {
          const pts = sec.points ?? []; // [lng,lat]順（GeoJSONと同じ）
          if (pts.length < 2) continue;
          const level =
            sec.section_type === "straight"
              ? "straight"
              : (sec.corner_level ?? "weak");
          features.push({
            type: "Feature",
            properties: { level, fade, tid: t.id },
            geometry: { type: "LineString", coordinates: pts },
          });
        }
      } else if (t.poly.length) {
        features.push({
          type: "Feature",
          properties: { level: "weak", fade, tid: t.id },
          geometry: {
            type: "LineString",
            coordinates: t.poly.map((p) => [p[1], p[0]]),
          },
        });
      }
    });
    return { type: "FeatureCollection", features };
  },

  addLayers: (map, onSelect) => {
    map.addSource(SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "touge-selected",
      type: "line",
      source: SOURCE,
      filter: ["==", ["get", "tid"], NO_SELECTION],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": COLORS.routeRed,
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 10, 14, 22],
        "line-blur": 3,
        "line-opacity": 0.75,
      },
    });
    map.addLayer({
      id: "touge-casing",
      type: "line",
      source: SOURCE,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 4, 14, 8.5],
        "line-opacity": ["*", 0.9, ["coalesce", ["get", "fade"], 1]],
      },
    });
    map.addLayer({
      id: "touge-line",
      type: "line",
      source: SOURCE,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": [
          "match",
          ["get", "level"],
          "strong",
          COLORS.cornerStrong,
          "medium",
          COLORS.cornerMedium,
          "weak",
          COLORS.cornerWeak,
          COLORS.straight,
        ],
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 14, 4.5],
        "line-opacity": ["coalesce", ["get", "fade"], 1],
      },
    });

    for (const layer of ["touge-line", "touge-casing"]) {
      map.on("click", layer, (e) => {
        const tid = e.features?.[0]?.properties?.tid;
        if (typeof tid === "number") onSelect(tid);
      });
      map.on("mouseenter", layer, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
      });
    }
  },

  setData: (map, geojson) => {
    (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(geojson);
  },

  setHighlight: (map, id) => {
    const sel = ["==", ["get", "tid"], id ?? NO_SELECTION];
    map.setFilter(
      "touge-selected",
      sel as Parameters<MaplibreMap["setFilter"]>[1],
    );
    map.setPaintProperty("touge-line", "line-opacity", [
      "coalesce",
      ["get", "fade"],
      1,
    ]);
    map.setPaintProperty("touge-casing", "line-opacity", [
      "*",
      0.9,
      ["coalesce", ["get", "fade"], 1],
    ]);
  },
};
