// Google Maps 経路案内 / ストリートビューへの外部リンク生成。

import type { LatLng } from "@/types/touge";

interface Urls {
  googleMap(poly: LatLng[]): string;
  streetView(poly: LatLng[]): string | null;
}

export const urls: Urls = {
  googleMap: (poly) => {
    if (!poly.length) return "#";
    const st = poly[0];
    const ct = poly[Math.floor(poly.length / 2)];
    const ed = poly[poly.length - 1];
    return `https://www.google.co.jp/maps/dir/${st[0]},${st[1]}/${ct[0]},${ct[1]}/${ed[0]},${ed[1]}`;
  },

  streetView: (poly) => {
    if (poly.length < 2) return null;
    const i = Math.floor(poly.length / 2);
    const a = poly[Math.max(0, i - 1)];
    const b = poly[Math.min(poly.length - 1, i + 1)];
    const c = poly[i];
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLng = toRad(b[1] - a[1]);
    const y = Math.sin(dLng) * Math.cos(toRad(b[0]));
    const x =
      Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) -
      Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(dLng);
    const heading = Math.round(
      ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
    );
    return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${c[0]},${c[1]}&heading=${heading}&pitch=0&fov=90`;
  },
};
