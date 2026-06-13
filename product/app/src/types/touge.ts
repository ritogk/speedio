// 峠データの型定義。スキーマの正は pipeline/postprocess/build_slim_targets.py の slim_touge()。

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

/** 上がり下がりの転換ポイント（凸=ピーク/凹=谷、始点・終点も含む） */
export interface UnevennessPoint {
  point: LatLng;
  /** 最低標高からの高さ(m) */
  prominence: number;
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
  // 以下は2026-06-13追加。再生成前の県のslimには存在しない
  /** 累積上り標高(m) */
  elevation_up?: number | null;
  /** 累積下り標高(m) */
  elevation_down?: number | null;
  /** 上がり下がりポイント数（凸+凹） */
  elevation_unevenness_count?: number | null;
  elevation_unevenness?: UnevennessPoint[] | null;
  /** 道路近傍の建物数 */
  building_nearby_cnt?: number | null;
  /** 起伏（アップダウン）回数 */
  undulation_cnt?: number | null;
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
  /** 累積上り標高(m)。データ未対応の県では null */
  upM: number | null;
  /** 累積下り標高(m)。データ未対応の県では null */
  downM: number | null;
  /** 上がり下がりポイント数。データ未対応の県では null */
  unevennessCount: number | null;
  /** 道路近傍の建物数。データ未対応の県では null */
  buildingCnt: number | null;
  /** 起伏（アップダウン）回数。データ未対応の県では null */
  undulationCnt: number | null;
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
