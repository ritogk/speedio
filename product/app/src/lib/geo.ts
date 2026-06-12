// 地理計算の純関数集（フェード係数・方位・間引き・距離サークル座標）。

import type { LatLng, LngLat } from "@/types/touge";

export interface RangeRing {
  r: number;
  ring: LngLat[];
  labelPos: LngLat;
}

interface Geo {
  fadeOf(i: number, len: number, floor: number): number;
  routeBearing(poly: LatLng[]): number;
  decimate<T>(points: T[], max: number): T[];
  buildRangeRings(
    lat: number,
    lng: number,
    step?: number,
    maxKm?: number,
  ): RangeRing[];
}

export const geo: Geo = {
  fadeOf: (i, len, floor) => {
    if (len <= 1) return 1;
    return Math.max(floor, 1 - (1 - floor) * (i / (len - 1)));
  },

  routeBearing: (poly) => {
    const st = poly[0];
    const ed = poly[poly.length - 1];
    return (Math.atan2(ed[1] - st[1], ed[0] - st[0]) * 180) / Math.PI;
  },

  decimate: <T>(points: T[], max: number): T[] => {
    if (points.length <= max) return points;
    const step = (points.length - 1) / (max - 1);
    return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
  },

  buildRangeRings: (lat, lng, step = 10, maxKm = 100) => {
    const latRad = (lat * Math.PI) / 180;
    const rings: RangeRing[] = [];
    for (let r = step; r <= maxKm; r += step) {
      const ring: LngLat[] = [];
      for (let i = 0; i <= 128; i++) {
        const th = (i / 128) * 2 * Math.PI;
        ring.push([
          lng + ((r * 1000) / (111320 * Math.cos(latRad))) * Math.sin(th),
          lat + ((r * 1000) / 111320) * Math.cos(th),
        ]);
      }
      rings.push({ r, ring, labelPos: [lng, lat + (r * 1000) / 111320] });
    }
    return rings;
  },
};
