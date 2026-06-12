// アプリ全体で共有する定数（都道府県・評価プリセット・デザイントークン）。

import type { PresetKey, PresetWeight } from "@/types/touge";

export const PREFECTURES: Record<string, string> = {
  "01": "北海道",
  "02": "青森県",
  "03": "岩手県",
  "04": "宮城県",
  "05": "秋田県",
  "06": "山形県",
  "07": "福島県",
  "08": "茨城県",
  "09": "栃木県",
  "10": "群馬県",
  "11": "埼玉県",
  "12": "千葉県",
  "13": "東京都",
  "14": "神奈川県",
  "15": "新潟県",
  "16": "富山県",
  "17": "石川県",
  "18": "福井県",
  "19": "山梨県",
  "20": "長野県",
  "21": "岐阜県",
  "22": "静岡県",
  "23": "愛知県",
  "24": "三重県",
  "25": "滋賀県",
  "26": "京都府",
  "27": "大阪府",
  "28": "兵庫県",
  "29": "奈良県",
  "30": "和歌山県",
  "31": "鳥取県",
  "32": "島根県",
  "33": "岡山県",
  "34": "広島県",
  "35": "山口県",
  "36": "徳島県",
  "37": "香川県",
  "38": "愛媛県",
  "39": "高知県",
  "40": "福岡県",
  "41": "佐賀県",
  "42": "長崎県",
  "43": "熊本県",
  "44": "大分県",
  "45": "宮崎県",
  "46": "鹿児島県",
  "47": "沖縄県",
};

// オブジェクトのキー順は "10"以降が"01"〜"09"より先に並ぶため明示ソート
export const PREFECTURE_ENTRIES: [string, string][] = Object.entries(
  PREFECTURES,
).sort((a, b) => a[0].localeCompare(b[0]));

export const HIGHWAY_LABEL: Record<string, string> = {
  trunk: "国道(主要)",
  trunk_link: "国道(主要)",
  primary: "国道",
  primary_link: "国道",
  secondary: "県道",
  secondary_link: "県道",
  tertiary: "一般道",
};

export const PRESET_LABELS: Record<PresetKey, string> = {
  balance: "バランス",
  corner: "コーナー重視",
  updown: "高低差重視",
  relax: "のんびり快走",
};

export const PRESET_HINTS: Record<PresetKey, string> = {
  balance: "コーナー・高低差・道幅をバランスよく評価します。",
  corner: "ヘアピンや中速コーナーが連続する道を上位にします。",
  updown: "アップダウンと標高差の大きい道を上位にします。",
  relax: "道幅が広く、緩いカーブ主体の快走路を上位にします。",
};

export const PRESET_WEIGHTS: Record<PresetKey, PresetWeight> = {
  balance: { corner: 1, updown: 1, width: 1 },
  corner: { corner: 2.2, updown: 0.7, width: 0.8 },
  updown: { corner: 0.7, updown: 2.2, width: 0.8 },
  relax: { corner: 0.4, updown: 0.6, width: 2.4 },
};

export const isPresetKey = (v: unknown): v is PresetKey =>
  typeof v === "string" && v in PRESET_WEIGHTS;

export const MARKER_N = 20;
export const PAGE_N = 30;
export const ORBIT_DEG_PER_SEC = 20;

// CSSのメディアクエリと一致させること
export const MOBILE_MAX_WIDTH = 760;

// assets/styles/tokens.css と同値（地図レイヤー等のJSから参照する用）
export const COLORS = {
  accent: "#E10600",
  routeRed: "#E10600",
  cornerStrong: "#FF453A",
  cornerMedium: "#FF9F0A",
  cornerWeak: "#30D158",
  straight: "#98989D",
} as const;
