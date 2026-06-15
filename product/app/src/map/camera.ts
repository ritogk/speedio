// カメラ演出（峠への滑空飛行・着地後オービット・表示領域パディング）。
// ユーザーが地図に触れたら演出を即中止し、演出由来の中断なら最後に着地位置を保証する。

import type { Map as MaplibreMap, PaddingOptions } from "maplibre-gl";

import { MOBILE_MAX_WIDTH, ORBIT_DEG_PER_SEC } from "@/lib/constants";
import { geo } from "@/lib/geo";
import type { RankedTouge } from "@/types/touge";

export interface ViewState {
  sheetHalf: boolean;
  sidebarHidden: boolean;
}

export interface CameraDirector {
  cancelOrbit(): void;
  orbitAround(center: [number, number]): void;
  flyToTouge(t: RankedTouge, padding: PaddingOptions): void;
  dispose(): void;
}

interface Camera {
  viewPadding(extra: number, view: ViewState): PaddingOptions;
  createDirector(map: MaplibreMap): CameraDirector;
}

type UserEvent = "dragstart" | "zoomstart" | "rotatestart" | "pitchstart";
const USER_EVENTS: UserEvent[] = [
  "dragstart",
  "zoomstart",
  "rotatestart",
  "pitchstart",
];
const CANVAS_EVENTS = ["pointerdown", "wheel", "touchstart"] as const;

export const camera: Camera = {
  viewPadding: (extra, view) => {
    if (window.innerWidth <= MOBILE_MAX_WIDTH) {
      const sheet = view.sheetHalf ? Math.round(window.innerHeight * 0.44) : 96;
      return {
        top: extra + 10,
        left: extra + 10,
        right: extra + 10,
        bottom: extra + sheet + 14,
      };
    }
    const side = view.sidebarHidden ? 0 : 350;
    return { top: extra, left: extra + side, right: extra, bottom: extra };
  },

  createDirector: (map) => {
    let orbitRaf: number | null = null;
    let flightAbort: (() => void) | null = null;

    const cancelOrbit = () => {
      if (orbitRaf !== null) {
        cancelAnimationFrame(orbitRaf);
        orbitRaf = null;
      }
    };

    const orbitAround = (center: [number, number]) => {
      cancelOrbit();
      const startBearing = map.getBearing();
      let t0: number | null = null;
      const step = (ts: number) => {
        if (t0 === null) t0 = ts;
        const deg = ((ts - t0) / 1000) * ORBIT_DEG_PER_SEC;
        map.jumpTo({ center, bearing: startBearing + deg });
        orbitRaf = deg < 360 ? requestAnimationFrame(step) : null;
      };
      orbitRaf = requestAnimationFrame(step);
    };

    const flyToTouge = (t: RankedTouge, padding: PaddingOptions) => {
      if (!t.poly.length) return;
      const mobile = window.innerWidth <= MOBILE_MAX_WIDTH;
      const target = {
        center: [t.center[1], t.center[0]] as [number, number],
        zoom: mobile ? 12.8 : 13.5,
        pitch: mobile ? 64 : 70,
        bearing: geo.routeBearing(t.poly),
        padding,
        duration: 1800,
        essential: true,
      };
      cancelOrbit();
      flightAbort?.();
      const onUser = () => {};
      for (const ev of USER_EVENTS) map.on(ev, onUser);
      const cleanup = () => {
        for (const ev of USER_EVENTS) map.off(ev, onUser);
        flightAbort = null;
      };
      flightAbort = () => {
        cleanup();
      };
      map.flyTo(target);
      map.once("moveend", () => {
        cleanup();
      });
    };

    const onCanvasInteract = () => cancelOrbit();
    const onUserInteract = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) cancelOrbit();
    };
    for (const ev of CANVAS_EVENTS) {
      map.getCanvas().addEventListener(ev, onCanvasInteract, { passive: true });
    }
    for (const ev of USER_EVENTS) map.on(ev, onUserInteract);

    const dispose = () => {
      cancelOrbit();
      flightAbort?.();
      for (const ev of CANVAS_EVENTS) {
        map.getCanvas().removeEventListener(ev, onCanvasInteract);
      }
      for (const ev of USER_EVENTS) map.off(ev, onUserInteract);
    };

    return { cancelOrbit, orbitAround, flyToTouge, dispose };
  },
};
