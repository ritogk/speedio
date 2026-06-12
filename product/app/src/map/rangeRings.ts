// 現在地からの距離サークル（10km刻み・100kmまで）の描画。

import maplibregl, {
  type GeoJSONSource,
  type Map as MaplibreMap,
} from "maplibre-gl";

import { geo } from "@/lib/geo";

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
      (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: rings.map((r) => ({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: r.ring },
        })),
      });
      labelMarkers.forEach((m) => m.remove());
      labelMarkers = rings.map((r) => {
        const el = document.createElement("div");
        el.className = "ring-label";
        el.textContent = `${r.r}km`;
        return new maplibregl.Marker({ element: el })
          .setLngLat(r.labelPos)
          .addTo(map);
      });
    },
  };
};

export const rangeRings = createRangeRings();
