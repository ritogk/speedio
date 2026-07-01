// state.js — 全共有状態・定数・ユーティリティ
// 他の全ファイルが App.xxx を参照する。このファイルは最初に読み込まれる。
// Owns: 全共有状態の定義
"use strict";

window.App = {
  // --- 定数 (Object.freeze で誤書き換えを防止) ---
  PREFECTURES: Object.freeze({
    "01":"北海道","02":"青森県","03":"岩手県","04":"宮城県","05":"秋田県","06":"山形県","07":"福島県",
    "08":"茨城県","09":"栃木県","10":"群馬県","11":"埼玉県","12":"千葉県","13":"東京都","14":"神奈川県",
    "15":"新潟県","16":"富山県","17":"石川県","18":"福井県","19":"山梨県","20":"長野県","21":"岐阜県",
    "22":"静岡県","23":"愛知県","24":"三重県","25":"滋賀県","26":"京都府","27":"大阪府","28":"兵庫県",
    "29":"奈良県","30":"和歌山県","31":"鳥取県","32":"島根県","33":"岡山県","34":"広島県","35":"山口県",
    "36":"徳島県","37":"香川県","38":"愛媛県","39":"高知県","40":"福岡県","41":"佐賀県","42":"長崎県",
    "43":"熊本県","44":"大分県","45":"宮崎県","46":"鹿児島県","47":"沖縄県"
  }),
  HIGHWAY_LABEL: Object.freeze({trunk:"国道(主要)",trunk_link:"国道(主要)",primary:"国道",primary_link:"国道",secondary:"県道",secondary_link:"県道",tertiary:"一般道"}),
  ADJACENT: Object.freeze({
    "01":[],"02":["03","05"],"03":["02","04","05","06"],"04":["03","05","06","07"],
    "05":["02","03","04","06"],"06":["03","04","05","07","15"],"07":["04","06","08","09","10","15"],
    "08":["07","09","11","12"],"09":["07","08","10","11"],"10":["07","09","11","15","20"],
    "11":["08","09","10","12","13","19","20"],"12":["08","11","13"],"13":["11","12","14","19"],
    "14":["13","19","22"],"15":["06","07","10","16","20"],"16":["15","17","20","21"],
    "17":["16","18","21"],"18":["17","21","25","26"],"19":["11","13","14","20","22"],
    "20":["10","11","15","16","19","21","22","23"],"21":["16","17","18","20","23","24","25"],
    "22":["14","19","20","23"],"23":["20","21","22","24"],"24":["21","23","25","26","29","30"],
    "25":["18","21","24","26"],"26":["18","25","27","28","29","30"],
    "27":["26","28","29","30"],"28":["26","27","30","31","33"],
    "29":["24","26","27","30"],"30":["24","26","27","29"],
    "31":["28","32","33"],"32":["31","34","35"],"33":["28","31","34"],
    "34":["32","33","35"],"35":["32","34"],
    "36":["37","38","39"],"37":["36","38"],"38":["36","37","39"],
    "39":["36","38"],"40":["41","43","44","46"],"41":["40","42"],
    "42":["41"],"43":["40","44","45","46"],"44":["40","43","45"],
    "45":["43","44","46"],"46":["40","43","45"],"47":[]
  }),
  presetHints: Object.freeze({
    balance:"コーナー・標高・道幅をバランスよく評価します。",
    corner:"ヘアピンや中速コーナーが連続する道を上位にします。",
    updown:"アップダウンと標高差の大きい道を上位にします。",
    nearby:"現在地から50km以内の峠を近い順に表示します（隣接県含む）。",
    seclusion:"建物が少ない秘境度の高い道を上位にします。",
    uphill:"アップダウンの回数が多い道を上位にします。"
  }),
  BALANCE_WEIGHTS: {
    elevation:1, elevation_unevenness:1, width:1.3, length:0.7,
    building:1, tunnel_outside:1,
    corner_week:1, corner_medium:1.3, corner_strong:1, corner_none:1,
    corner_balance:1, claude_center_line_section:1.3
  },
  MARKER_N: 20,
  PAGE_N: 30,
  BUMP_SVG: '<svg class="bump-ico" viewBox="0 0 20 18"><path d="M0 9Q5 1 10 9Q15 17 20 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',

  // --- ミュータブル状態 ---
  // owner: map-init.js
  map: null,
  mapReady: false,
  // owner: data-loader.js
  currentItems: [],
  loadedPrefs: new Set(),
  // owner: ranking.js
  lastRanked: [],
  searchQuery: "",
  visibleCount: 30,
  // owner: ui-events.js
  currentPreset: "balance",
  userLatLng: null,
  distanceFilter: null,
  hideVisited: false,
  showOnlyVisited: false,
  showOnlyFavorites: false,
  widthFilter: 0.85,
  // owner: data-loader.js
  dataVersionChecked: false,
  dataVersionChanged: false,
  // owner: visit.js
  visitedKeys: new Set(JSON.parse(localStorage.getItem("touge.visited") || "[]")),
  favoriteKeys: new Set(JSON.parse(localStorage.getItem("touge.favorites") || "[]")),
  visitedDates: JSON.parse(localStorage.getItem("touge.visitedDates") || "{}"),
  // owner: various
  globalIdCounter: 0,
  locatingBusy: false,

  // --- ユーティリティ ---
  $: function(id){ return document.getElementById(id); },
  escapeHtml: function(s){
    return String(s).replace(/[&<>"']/g, function(c){ return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]; });
  },
  cssVar: function(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); },
  tierOf: function(rank, total){
    var t1 = Math.max(3, Math.round(total * 0.10));
    var t2 = Math.max(10, Math.round(total * 0.30));
    var t3 = Math.max(20, Math.round(total * 0.60));
    return rank < t1 ? 1 : rank < t2 ? 2 : rank < t3 ? 3 : 4;
  },
  fadeOf: function(i, len, floor){
    if(len <= 1) return 1;
    return Math.max(floor, 1 - (1 - floor) * (i / (len - 1)));
  },
  calcBalanceScore: function(t, w){
    var BALANCE_DIVISOR = Object.keys(App.BALANCE_WEIGHTS).length;
    return (
      t.scoreElevation * w.elevation +
      t.scoreElevationUnevenness * w.elevation_unevenness +
      t.scoreWidth * w.width +
      t.scoreLength * w.length +
      t.scoreBuilding * w.building +
      t.scoreTunnelOutside * w.tunnel_outside +
      (t.scoreCornerWeek * w.corner_week +
       t.scoreCornerMedium * w.corner_medium +
       t.scoreCornerStrong * w.corner_strong +
       t.scoreCornerNone * w.corner_none) +
      t.scoreCornerBalance * w.corner_balance +
      t.scoreClaudeCenterLineSection * w.claude_center_line_section
    ) / BALANCE_DIVISOR;
  },
  haversineKm: function(lat1,lng1,lat2,lng2){
    var R=6371, toR=function(d){ return d*Math.PI/180; };
    var dLat=toR(lat2-lat1), dLng=toR(lng2-lng1);
    var a=Math.pow(Math.sin(dLat/2),2)+Math.cos(toR(lat1))*Math.cos(toR(lat2))*Math.pow(Math.sin(dLng/2),2);
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  },
  bumpIcons: function(n){
    return App.BUMP_SVG+' ×'+n;
  },
  todayStr: new Date().toISOString().slice(0, 10),
  VISIT_DELAY_KEY: "touge.visitDelay",
  VISIT_IMMEDIATE_KEY: "touge.visitImmediate",
  getVisitDelayMs: function(){ return (parseInt(localStorage.getItem(App.VISIT_DELAY_KEY),10) || 60) * 1000; },

  // --- Toast / Loading ---
  _toastTimer: null,
  toast: function(msg, type){
    var el = App.$("toast");
    el.textContent = msg;
    el.classList.remove("error","has-act");
    if(type === "error") el.classList.add("error");
    el.classList.add("show");
    clearTimeout(App._toastTimer);
    App._toastTimer = setTimeout(function(){ el.classList.remove("show","error","has-act"); }, 3500);
  },
  // アクションボタン付きトースト（お気に入り追加など、後追いのワンタップ操作用）
  toastAction: function(msg, label, fn){
    var el = App.$("toast");
    el.textContent = msg;
    el.classList.remove("error");
    var btn = document.createElement("button");
    btn.className = "toast-act";
    btn.textContent = label;
    btn.addEventListener("click", function(ev){
      ev.stopPropagation();
      el.classList.remove("show","has-act");
      fn();
    });
    el.appendChild(btn);
    el.classList.add("show","has-act");
    clearTimeout(App._toastTimer);
    App._toastTimer = setTimeout(function(){ el.classList.remove("show","has-act"); }, 6000);
  },
  showLoading: function(on, text){
    App.$("loading").classList.toggle("show", on);
    if(text) App.$("loadingText").textContent = text;
  },

  // --- Location marker ---
  _locMarker: null,
  placeLocMarker: function(lng, lat){
    if(App._locMarker) App._locMarker.remove();
    App._locMarker = new maplibregl.Marker({color:App.cssVar("--route-red"), occludedOpacity:1}).setLngLat([lng, lat]).addTo(App.map);
    return App._locMarker;
  },

  // --- isMobile ---
  isMobileDevice: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
  isMobile: function(){ return window.innerWidth <= 760; },
};
