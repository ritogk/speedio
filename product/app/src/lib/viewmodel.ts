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

    // コーナー構成割合の集計
    const secs = raw.road_section ?? [];
    let segStrong = 0,
      segMedium = 0,
      segWeak = 0,
      segStraight = 0;
    secs.forEach((s) => {
      const n = Math.max(0, (s.points ?? []).length - 1);
      const lv =
        s.section_type === "straight" ? "none" : (s.corner_level ?? "none");
      if (lv === "strong") segStrong += n;
      else if (lv === "medium") segMedium += n;
      else if (lv === "weak") segWeak += n;
      else segStraight += n;
    });
    const segTotal = segStrong + segMedium + segWeak + segStraight || 1;

    return {
      id: idx,
      name,
      routeLabel: (highway && HIGHWAY_LABEL[highway]) || "一般道",
      lengthKm: Math.round((raw.length ?? 0) / 100) / 10,
      height: Math.round(raw.elevation_height ?? 0),
      corner: clamp01(1 - (raw.score_corner_none ?? 1)),
      updown: clamp01(raw.score_elevation_unevenness ?? 0),
      width: clamp01(
        raw.score_claude_center_line_section ?? raw.score_width ?? 0,
      ),
      center,
      poly,
      roadSection: secs,
      upM: raw.elevation_up != null ? Math.round(raw.elevation_up) : null,
      downM: raw.elevation_down != null ? Math.round(raw.elevation_down) : null,
      unevennessCount: raw.elevation_unevenness_count ?? null,
      buildingCnt: raw.building_nearby_cnt ?? null,
      buildingDensity:
        raw.building_nearby_cnt != null && (raw.length ?? 0) > 0
          ? Math.round(
              (raw.building_nearby_cnt / ((raw.length ?? 0) / 1000)) * 10,
            ) / 10
          : null,
      undulationCnt: raw.undulation_cnt ?? null,
      uphillCnt: raw.uphill_cnt ?? null,
      downhillCnt: raw.downhill_cnt ?? null,
      pctStrong: Math.round((segStrong / segTotal) * 100),
      pctMedium: Math.round((segMedium / segTotal) * 100),
      pctWeak: Math.round((segWeak / segTotal) * 100),
      pctStraight: Math.round((segStraight / segTotal) * 100),
      elevationSmooth: raw.elevation_smooth ?? [],
      buildings: raw.buildings ?? [],
      elevSections: raw.elevation_unevenness_sections ?? null,
    };
  },
};
