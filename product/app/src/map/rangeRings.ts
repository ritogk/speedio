// 現在地からの距離サークル（10km刻み・70kmまで）の描画。

import maplibregl, {
  type GeoJSONSource,
  type Map as MaplibreMap,
} from "maplibre-gl";

import { geo } from "@/lib/geo";
import type { LngLat } from "@/types/touge";

interface RangeRingsLayer {
  addLayer(map: MaplibreMap): void;
  draw(map: MaplibreMap, lat: number, lng: number): void;
}

const SOURCE = "rings";

const createRangeRings = (): RangeRingsLayer => {
  let labelMarkers: maplibregl.Marker[] = [];

  return {
    addLayer: (map) => {
      map.addSource(SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "rings-fill",
        type: "fill",
        source: SOURCE,
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["get", "r"],
            10,
            "#4A9E60",
            30,
            "#B89E40",
            50,
            "#B07040",
            70,
            "#9E4A4A",
          ],
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["get", "r"],
            10,
            0.22,
            70,
            0.10,
          ],
        },
      });
      map.addLayer({
        id: SOURCE,
        type: "line",
        source: SOURCE,
        paint: {
          "line-color": "#ffffff",
          "line-opacity": 0.55,
          "line-width": 1.5,
          "line-dasharray": [3, 3],
        },
      });
    },

    draw: (map, lat, lng) => {
      const rings = geo.buildRangeRings(lat, lng);
      // Polygon features with donut holes for fill layer (largest first)
      const features = [...rings].reverse().map((r, i, arr) => {
        const coords: LngLat[][] = [r.ring];
        // Add inner ring (hole) from the next smaller radius
        if (i < arr.length - 1) coords.push([...arr[i + 1].ring].reverse());
        return {
          type: "Feature" as const,
          properties: { r: r.r },
          geometry: {
            type: "Polygon" as const,
            coordinates: coords,
          },
        };
      });
      (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features,
      });
      labelMarkers.forEach((m) => m.remove());
      labelMarkers = rings.map((r) => {
        const el = document.createElement("div");
        el.className = "ring-label";
        el.textContent = `${r.r}km`;
        return new maplibregl.Marker({ element: el, occludedOpacity: 1 })
          .setLngLat(r.labelPos)
          .addTo(map);
      });
    },
  };
};

export const rangeRings = createRangeRings();
