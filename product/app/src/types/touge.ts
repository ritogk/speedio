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
  /** 区間ごと中央線スコア（score_width の上位互換） */
  score_claude_center_line_section?: number | null;
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
  /** 登り回数 */
  uphill_cnt?: number | null;
  /** 下り回数 */
  downhill_cnt?: number | null;
  /** 平滑化済み標高(m) — geometry_list と 1:1 対応 */
  elevation_smooth?: number[] | null;
  /** 建物ポリゴン座標 [[lat,lng],...] の配列 */
  buildings?: LatLng[][] | null;
  /** 登り/下り区間 */
  elevation_unevenness_sections?: ElevSections | null;
}

/** 登り/下り区間の start/end 座標 */
export interface ElevSectionRange {
  start: LatLng;
  end: LatLng;
}

export interface ElevSections {
  uphill?: ElevSectionRange[];
  downhill?: ElevSectionRange[];
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
  /** 建物密度 (棟/km)。データ未対応の県では null */
  buildingDensity: number | null;
  /** 起伏（アップダウン）回数。データ未対応の県では null */
  undulationCnt: number | null;
  /** 登り回数。データ未対応の県では null */
  uphillCnt: number | null;
  /** 下り回数。データ未対応の県では null */
  downhillCnt: number | null;
  /** コーナー構成割合(%) — strong */
  pctStrong: number;
  /** コーナー構成割合(%) — medium */
  pctMedium: number;
  /** コーナー構成割合(%) — weak */
  pctWeak: number;
  /** コーナー構成割合(%) — straight */
  pctStraight: number;
  /** 平滑化済み標高(m) — poly と 1:1 対応 */
  elevationSmooth: number[];
  /** 建物ポリゴン座標 [[lat,lng],...] の配列 */
  buildings: LatLng[][];
  /** 登り/下り区間 */
  elevSections: ElevSections | null;
  /** 現在地からの直線距離(km)。位置情報未取得時は undefined */
  distanceKm?: number;
  /** 所属県コード（複数県データ混在時のフィルタ用） */
  _pref?: string;
}

export interface RankedTouge extends TougeVM {
  score: number;
}

export type PresetKey = "balance" | "corner" | "updown" | "nearby" | "seclusion" | "uphill";

export interface PresetWeight {
  corner: number;
  updown: number;
  width: number;
}
