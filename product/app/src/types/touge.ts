// 峠データの型定義。スキーマの正は html/build_slim_targets.py の slim_touge()。

/** [緯度, 経度] — geometry_list の座標順 */
export type LatLng = [number, number];

/** [経度, 緯度] — road_section.points / GeoJSON の座標順 */
export type LngLat = [number, number];

export type CornerLevel = "strong" | "medium" | "weak" | "none";

export interface RoadSection {
  section_type: "corner" | "straight";
  corner_level: CornerLevel | null;
  points: LngLat[];
}

export interface RawTouge {
  length: number | null;
  highway: string | string[] | null;
  name: string | string[] | null;
  elevation_height: number | null;
  score_elevation: number | null;
  score_elevation_unevenness: number | null;
  score_width: number | null;
  score_corner_none: number | null;
  geometry_list: LatLng[] | null;
  road_section: RoadSection[] | null;
}

export interface TougeVM {
  /** 県データ内のインデックス。県を跨ぐと重複するためキャッシュキーには県コードを併用する */
  id: number;
  name: string;
  routeLabel: string;
  lengthKm: number;
  height: number;
  corner: number;
  updown: number;
  width: number;
  center: LatLng;
  poly: LatLng[];
  roadSection: RoadSection[];
}

export interface RankedTouge extends TougeVM {
  score: number;
}

export type PresetKey = "balance" | "corner" | "updown" | "relax";

export interface PresetWeight {
  corner: number;
  updown: number;
  width: number;
}
