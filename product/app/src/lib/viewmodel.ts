// target.slim.json の生データ → 表示用ビューモデル変換。

import { HIGHWAY_LABEL } from "@/lib/constants";
import type { LatLng, RawTouge, TougeVM } from "@/types/touge";

interface TougeViewModel {
  fromRaw(raw: RawTouge, idx: number): TougeVM;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const FALLBACK_CENTER: LatLng = [35.0, 137.0];

export const tougeViewModel: TougeViewModel = {
  fromRaw: (raw, idx) => {
    const poly = raw.geometry_list ?? [];
    const center = poly.length
      ? poly[Math.floor(poly.length / 2)]
      : FALLBACK_CENTER;
    let name = raw.name;
    if (Array.isArray(name)) name = name.filter(Boolean).join(" / ");
    if (!name) name = "（名称未登録の道）";
    const highway = Array.isArray(raw.highway) ? raw.highway[0] : raw.highway;
    return {
      id: idx,
      name,
      routeLabel: (highway && HIGHWAY_LABEL[highway]) || "一般道",
      lengthKm: Math.round((raw.length ?? 0) / 100) / 10,
      height: Math.round(raw.elevation_height ?? 0),
      corner: clamp01(1 - (raw.score_corner_none ?? 1)),
      updown: clamp01(
        ((raw.score_elevation ?? 0) + (raw.score_elevation_unevenness ?? 0)) /
          2,
      ),
      width: clamp01(raw.score_width ?? 0),
      center,
      poly,
      roadSection: raw.road_section ?? [],
      upM: raw.elevation_up != null ? Math.round(raw.elevation_up) : null,
      downM: raw.elevation_down != null ? Math.round(raw.elevation_down) : null,
      unevennessCount: raw.elevation_unevenness_count ?? null,
      buildingCnt: raw.building_nearby_cnt ?? null,
    };
  },
};
