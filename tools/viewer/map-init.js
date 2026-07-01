// map-init.js — 地図初期化・レイヤー管理・描画
// Uses: App.$, App.escapeHtml, App.cssVar, App.tierOf, App.fadeOf, App.lastRanked, App.MARKER_N, App.visitedKeys
// Provides: App.initMap(), App.drawMap(), App.flyToTouge(), App.initialCamera(), App.fitBoundsZoomed(), App.viewPadding(), App.highlightOnMap(), App.cancelOrbit(), App.drawRangeRings()
"use strict";

const INITIAL_CAM = Object.freeze({
  FRESH:      "fresh",      // 初回訪問: 現在地周辺の峠bboxにフィット
  RESTORED:   "restored",   // セッション復元: フィルタ適用後の峠bboxにフィット
  NAV_RETURN: "nav-return"  // ナビから戻った: 対象峠にズーム
});

var markersById = {};
var pendingGeojson = null;
var orbitRaf = null;
var ringLabelMarkers = [];
var levelColor = null;
var FIT_ZOOM_EXTRA = 0.9;
var ORBIT_DEG_PER_SEC = 20;
var lineClickHandled = false;

App.sheetState = "peek";

App.initMap = function(){
var GSI_ATTR = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>';
App.map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      photo: {
        type:"raster",
        tiles:["https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"],
        tileSize:256, maxzoom:18, attribution:GSI_ATTR
      },
      gsiTerrain: {
        type:"raster-dem",
        tiles:["gsidem://https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png"],
        tileSize:256, maxzoom:12
      }
    },
    layers: [
      {id:"photo", type:"raster", source:"photo",
       paint:{"raster-brightness-max":.9, "raster-saturation":-.1, "raster-contrast":.03}}, // スモーク（明るさを抑えて彩度も少し落とす）
      {id:"greenTint", type:"background",
       paint:{"background-color":"#1E4D33", "background-opacity":.18}}, // 地表に重ねる濃い緑の薄いベール
      {id:"hillshade", type:"hillshade", source:"gsiTerrain", // DEMから陰影を生成して尾根・谷を彫り込む
       paint:{
         "hillshade-exaggeration":.25,
         "hillshade-shadow-color":"#101510",
         "hillshade-highlight-color":"#FFFFFF",
         "hillshade-accent-color":"#101510"
       }}
    ],
    sky: {
      "sky-color":"#86A8CF",        // 上空
      "horizon-color":"#E9EDF1",    // 地平線の霞
      "fog-color":"#DCE3E9",        // 遠景のフォグ
      "sky-horizon-blend":.6,
      "horizon-fog-blend":.6,
      "fog-ground-blend":.55
    },
    terrain: {source:"gsiTerrain", exaggeration:1.2}
  },
  center: [137.5, 36.2],
  zoom: 5,
  pitch: 55,
  bearing: -10,
  maxPitch: 75,
  renderWorldCopies: false,
  attributionControl: {compact:true}
});

levelColor = {
  strong:App.cssVar("--corner-strong"), medium:App.cssVar("--corner-medium"),
  weak:App.cssVar("--corner-weak"), none:App.cssVar("--straight"), straight:App.cssVar("--straight")
};

// ユーザーが地図に触れた・動かしたらオービット演出を即座に止める
["pointerdown","wheel","touchstart"].forEach(ev=>
  App.map.getCanvas().addEventListener(ev, ()=>App.cancelOrbit(), {passive:true}));
["dragstart","zoomstart","rotatestart","pitchstart"].forEach(ev=>
  App.map.on(ev, function(e){ if(e.originalEvent) App.cancelOrbit(); }));


App.map.on("load", function(){
  // 現在地からの距離サークル（20km刻み、道路レイヤーより下に描く）
  App.map.addSource("rings", {type:"geojson", data:{type:"FeatureCollection",features:[]}});
  App.map.addLayer({
    id:"rings-fill", type:"fill", source:"rings",
    paint:{
      "fill-color":["interpolate",["linear"],["get","r"],10,"#4A9E60",30,"#B89E40",50,"#B07040",70,"#9E4A4A"],
      "fill-opacity":["interpolate",["linear"],["get","r"],10,.22,70,.10]
    }
  });
  App.map.addLayer({
    id:"rings", type:"line", source:"rings",
    paint:{
      "line-color":"#ffffff",
      "line-opacity":.55,
      "line-width":1.5,
      "line-dasharray":[3,3]
    }
  });

  // 交番レイヤー（絵文字アイコン、道路ラインより下に配置）
  {
    var sz = 32, cv = document.createElement("canvas");
    cv.width = cv.height = sz;
    var cx = cv.getContext("2d");
    cx.font = (sz-4)+"px serif";
    cx.textAlign = "center"; cx.textBaseline = "middle";
    cx.fillText("👮", sz/2, sz/2 + 1);
    App.map.addImage("koban-ico", {width:sz, height:sz, data:new Uint8Array(cx.getImageData(0,0,sz,sz).data)});
  }
  App.map.addSource("koban", {type:"geojson", data:{type:"FeatureCollection",features:[]}});
  App.map.addLayer({
    id:"koban-sym", type:"symbol", source:"koban",
    layout:{
      "icon-image":"koban-ico",
      "icon-size":["interpolate",["linear"],["zoom"],8,.4,14,.7],
      "icon-allow-overlap":false,
      "icon-optional":true,
      "visibility":"none"
    }
  });
  App.map.on("click","koban-sym",function(e){
    var f = e.features?.[0];
    if(!f) return;
    new maplibregl.Popup({offset:8,closeButton:false,maxWidth:"200px"})
      .setLngLat(e.lngLat)
      .setHTML(`<div style="font-size:12px;font-weight:500">${App.escapeHtml(f.properties.name||"交番")}</div>`)
      .addTo(map);
  });
  App.map.on("mouseenter","koban-sym",function(){ App.map.getCanvas().style.cursor="pointer"; });
  App.map.on("mouseleave","koban-sym",function(){ App.map.getCanvas().style.cursor=""; });

  // 観光名所クリック → ポップアップ
  App.map.on("click","tourist-icon",function(e){
    var f = e.features?.[0];
    if(!f) return;
    new maplibregl.Popup({offset:8,closeButton:false,maxWidth:"220px"})
      .setLngLat(e.lngLat)
      .setHTML(`<div style="font-size:12px;font-weight:600">📷 ${App.escapeHtml(f.properties.name||"観光名所")}</div>`)
      .addTo(map);
  });
  App.map.on("mouseenter","tourist-icon",function(){ App.map.getCanvas().style.cursor="pointer"; });
  App.map.on("mouseleave","tourist-icon",function(){ App.map.getCanvas().style.cursor=""; });

  // 有料道路クリック → ポップアップ
  App.map.on("click","toll-roads-line",function(e){
    var f = e.features?.[0];
    if(!f) return;
    var name = f.properties.name || "有料道路";
    new maplibregl.Popup({offset:8,closeButton:false,maxWidth:"220px"})
      .setLngLat(e.lngLat)
      .setHTML(`<div style="font-size:12px;font-weight:600">💴 ${App.escapeHtml(name)}</div>`)
      .addTo(map);
  });
  App.map.on("mouseenter","toll-roads-line",function(){ App.map.getCanvas().style.cursor="pointer"; });
  App.map.on("mouseleave","toll-roads-line",function(){ App.map.getCanvas().style.cursor=""; });

  // 重要物流道路レイヤー（峠ラインより下に配置）
  App.map.addSource("logistics", {type:"geojson", data:{type:"FeatureCollection",features:[]}});
  App.map.addLayer({
    id:"logistics-casing", type:"line", source:"logistics",
    layout:{"line-cap":"round","line-join":"round","visibility":"none"},
    paint:{
      "line-color":"#D32F2F",
      "line-width":["interpolate",["linear"],["zoom"],6,5,10,8,14,12],
      "line-opacity":.15
    }
  });
  App.map.addLayer({
    id:"logistics-main", type:"line", source:"logistics",
    filter:["==",["get","cat"],1],
    layout:{"line-cap":"round","line-join":"round","visibility":"none"},
    paint:{
      "line-color":"#D32F2F",
      "line-width":["interpolate",["linear"],["zoom"],6,2,10,4,14,6],
      "line-opacity":.75
    }
  });
  App.map.addLayer({
    id:"logistics-alt", type:"line", source:"logistics",
    filter:["==",["get","cat"],2],
    layout:{"line-cap":"round","line-join":"round","visibility":"none"},
    paint:{
      "line-color":"#E57373",
      "line-width":["interpolate",["linear"],["zoom"],6,1.5,10,3,14,5],
      "line-opacity":.5,
      "line-dasharray":[4,3]
    }
  });

  // 道路レイヤー（選択グロー + 白縁 + コーナー色分け）
  App.map.addSource("touge", {type:"geojson", data:{type:"FeatureCollection",features:[]}});
  App.map.addLayer({
    id:"touge-selected", type:"line", source:"touge",
    filter:["==",["get","tid"],-9999],
    layout:{"line-cap":"round","line-join":"round"},
    paint:{
      "line-color":App.cssVar("--route-red"),
      "line-gap-width":["interpolate",["linear"],["zoom"],8,3,14,6],
      "line-width":["interpolate",["linear"],["zoom"],8,5,14,9],
      "line-blur":4,
      "line-opacity":.55
    }
  });
  App.map.addLayer({
    id:"touge-casing", type:"line", source:"touge",
    layout:{"line-cap":"round","line-join":"round"},
    paint:{
      "line-color":["case",["==",["get","visited"],1],"#9B30FF",
        ["step",["get","tier"],"#FF3CAC",2,"#00D4AA",3,"#4a7fbf",4,"#6B7580"]],
      "line-width":["interpolate",["linear"],["zoom"],
        8,["step",["get","tier"],13,2,11,3,8,4,6],
        14,["step",["get","tier"],22,2,19,3,15,4,12]],
      "line-blur":["step",["get","tier"],6,2,4,3,0,4,0],
      "line-opacity":["*",.85,["coalesce",["get","fade"],1]]
    }
  });
  App.map.addLayer({
    id:"touge-white", type:"line", source:"touge",
    layout:{"line-cap":"round","line-join":"round"},
    paint:{
      "line-color":"#ffffff",
      "line-width":["interpolate",["linear"],["zoom"],
        8,["step",["get","tier"],9,2,7,3,4.5,4,3.5],
        14,["step",["get","tier"],16,2,13,3,9.5,4,7.5]],
      "line-blur":["step",["get","tier"],4,2,3,3,0,4,0],
      "line-opacity":["*",.8,["coalesce",["get","fade"],1]]
    }
  });
  App.map.addLayer({
    id:"touge-line", type:"line", source:"touge",
    layout:{"line-cap":"round","line-join":"round"},
    paint:{
      "line-color":["match",["get","level"],
        "strong",levelColor.strong,
        "medium",levelColor.medium,
        "weak",levelColor.weak,
        levelColor.straight],
      "line-width":["interpolate",["linear"],["zoom"],
        8,["step",["get","tier"],3,2,2.5,3,2,4,1.5],
        14,["step",["get","tier"],6,2,5.25,3,4.5,4,3.5]],
      "line-opacity":["coalesce",["get","fade"],1]
    }
  });
  // 峠×有料道路の重複強調レイヤー（ホットピンク）
  App.map.addSource("touge-toll",{type:"geojson",data:{type:"FeatureCollection",features:[]}});
  App.map.addLayer({
    id:"touge-toll-glow", type:"line", source:"touge-toll",
    layout:{"line-cap":"round","line-join":"round"},
    paint:{
      "line-color":"#FF1493",
      "line-width":["interpolate",["linear"],["zoom"],8,12,14,20],
      "line-blur":5,
      "line-opacity":.6
    }
  });
  App.map.addLayer({
    id:"touge-toll-line", type:"line", source:"touge-toll",
    layout:{"line-cap":"round","line-join":"round"},
    paint:{
      "line-color":"#FF1493",
      "line-width":["interpolate",["linear"],["zoom"],8,3,14,5.5],
      "line-opacity":.9
    }
  });
  // 峠×物流道路の重複強調レイヤー（本線=黄、補完路=緑）
  App.map.addSource("touge-logistics",{type:"geojson",data:{type:"FeatureCollection",features:[]}});
  App.map.addLayer({
    id:"touge-logistics-glow", type:"line", source:"touge-logistics",
    layout:{"line-cap":"round","line-join":"round"},
    paint:{
      "line-color":["match",["get","cat"],1,"#FFD600","#43A047"],
      "line-width":["interpolate",["linear"],["zoom"],8,10,14,18],
      "line-blur":6,
      "line-opacity":.5
    }
  });
  App.map.addLayer({
    id:"touge-logistics-line", type:"line", source:"touge-logistics",
    layout:{"line-cap":"round","line-join":"round"},
    paint:{
      "line-color":["match",["get","cat"],1,"#FFD600","#43A047"],
      "line-width":["interpolate",["linear"],["zoom"],8,2.5,14,5],
      "line-opacity":.85
    }
  });

  // 訪問確認ライン（現在地→峠ST）
  App.map.addSource("visit-line", {type:"geojson", data:{type:"FeatureCollection",features:[]}});
  App.map.addLayer({
    id:"visit-line-layer", type:"line", source:"visit-line",
    layout:{"line-cap":"round","line-join":"round"},
    paint:{
      "line-color":"#E53935",
      "line-width":6,
      "line-opacity":0.85,
      "line-dasharray":[3,2]
    }
  });
  // 訪問確認ライン矢印
  {
    var sz = 48, cv = document.createElement("canvas");
    cv.width = cv.height = sz;
    var cx = cv.getContext("2d");
    cx.fillStyle = "#E53935";
    cx.beginPath();
    cx.moveTo(sz/2, 4);
    cx.lineTo(sz-4, sz-4);
    cx.lineTo(sz/2, sz-10);
    cx.lineTo(4, sz-4);
    cx.closePath();
    cx.fill();
    App.map.addImage("visit-arrow-ico", {width:sz, height:sz, data:new Uint8Array(cx.getImageData(0,0,sz,sz).data)});
  }
  App.map.addSource("visit-arrow", {type:"geojson", data:{type:"FeatureCollection",features:[]}});
  App.map.addLayer({
    id:"visit-arrow-layer", type:"symbol", source:"visit-arrow",
    layout:{
      "icon-image":"visit-arrow-ico",
      "icon-size":0.5,
      "icon-rotate":["get","bearing"],
      "icon-rotation-alignment":"map",
      "icon-allow-overlap":true
    }
  });

  // 道路ラインを直接クリック/タップで選択（casingの方が太いのでタップ判定に含める）
  // 3レイヤーが同じクリックで全て発火するので、最初の1つだけ処理する
  // lineClickHandled already declared above = false;
  ["touge-line","touge-white","touge-casing"].forEach(layer=>{
    App.map.on("click", layer, function(e){
      if(lineClickHandled) return;
      lineClickHandled = true;
      setTimeout(function(){ lineClickHandled = false; }, 0);
      var tid = e.features?.[0]?.properties?.tid;
      var t = App.lastRanked.find(x=>x.id === tid);
      if(t) App.revealAndSelect(t);
    });
    App.map.on("mouseenter", layer, function(){ App.map.getCanvas().style.cursor = "pointer"; });
    App.map.on("mouseleave", layer, function(){ App.map.getCanvas().style.cursor = ""; });
  });
  App.mapReady = true;
  if(pendingGeojson){ App.map.getSource("touge").setData(pendingGeojson); pendingGeojson = null; }
  if(App._flushPendingDataLayers) App._flushPendingDataLayers();
});
}; // end App.initMap

App.drawMap = function(list){
  // GeoJSON生成: road_sectionをコーナーレベル毎のLineStringに
  var features = [];
  list.forEach((t,i)=>{
    var tier = App.tierOf(i, list.length);
    var fade = tier === 1 ? 1.0 : tier === 2 ? Math.max(0.7, App.fadeOf(i, list.length, 0.25)) : App.fadeOf(i, list.length, 0.25);
    var tv = (t.stableKey && App.visitedKeys.has(t.stableKey)) ? 1 : 0;
    if(t.roadSection.length){
      t.roadSection.forEach(sec=>{
        var pts = (sec.points||[]);
        if(pts.length < 2) return;
        var lv = (sec.section_type === "straight") ? "straight" : (sec.corner_level || "weak");
        features.push({type:"Feature",properties:{level:lv,fade,tid:t.id,visited:tv,tier},geometry:{type:"LineString",coordinates:pts}});
      });
    }else if(t.poly.length){
      features.push({type:"Feature",properties:{level:"weak",fade,tid:t.id,visited:tv,tier},
        geometry:{type:"LineString",coordinates:t.poly.map(p=>[p[1],p[0]])}});
    }
  });
  var geojson = {type:"FeatureCollection", features};
  if(App.mapReady){ App.map.getSource("touge").setData(geojson); App.updateOverlapLayer(); App.updateTollOverlapLayer(); }
  else pendingGeojson = geojson;

  // ランクマーカー（峠IDで差分更新: 残る峠は順位・位置の書き換えだけ、消えた峠のみremove）
  var nextMarkers = {};
  list.slice(0, App.MARKER_N).forEach((t,i)=>{
    var m = markersById[t.id];
    var isNew = !m;
    if(isNew){
      var el = document.createElement("div");
      el.className = "rank-marker";
      el.addEventListener("click",function(){
        var tt = App.lastRanked.find(x=>x.id === Number(el.dataset.tid));
        if(tt) App.revealAndSelect(tt);
      });
      m = new maplibregl.Marker({element:el, occludedOpacity:1});
    }
    // className丸ごと代入はMapLibreが付与するmaplibregl-marker(position:absolute)を消すのでclassListで差し替える
    var mel = m.getElement();
    mel.dataset.tid = t.id;
    mel.classList.remove("tier-1","tier-2","tier-3","tier-4");
    mel.classList.add("tier-" + App.tierOf(i, list.length));
    mel.textContent = i+1;
    m.setLngLat([t.center[1], t.center[0]]);
    if(isNew) m.addTo(App.map);
    nextMarkers[t.id] = m;
    delete markersById[t.id];
  });
  Object.values(markersById).forEach(m=>m.remove());
  markersById = nextMarkers;
};

App.viewPadding = function(extra){
  var e = extra || 0;
  if(window.innerWidth <= 760){
    var sheet;
    if(App.sheetState === "card-peek"){
      sheet = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--card-peek-h")) || 96;
    } else if(App.sheetState === "half"){
      sheet = window.innerHeight * 0.44;
    } else if(App.sheetState === "full"){
      sheet = window.innerHeight * 0.8;
    } else {
      sheet = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sheet-peek")) || 56;
    }
    return {top:e+80, left:e+10, right:e+10, bottom:e+Math.round(sheet)+14};
  }
  return {top:e, left:e, right:e, bottom:e};
};

// pitch後がけでも全点が画面内に残るカメラを求める。
// cameraForBoundsはpitch 0（真上視点）前提で計算するため、そのままpitchと
// ズーム補正を後がけすると手前側の点が画面下に落ちる（特に横長のPC画面。
// スマホ縦画面はviewPaddingの大きな余白が偶然吸収していた）。
// 候補カメラをtransformのcloneに投影し、全点がsafePadding内に入るまでズームを引く。
App.cameraForPointsPitched = function(lngLats, opts){
  var b = new maplibregl.LngLatBounds();
  lngLats.forEach(function(p){ b.extend(p); });
  var cam;
  try{
    // maxZoom:undefined を渡すとmaplibreのデフォルトを上書きしてNaN例外になるため、指定時のみ含める
    var boundsOpts = {bearing: opts.bearing || 0, padding: opts.padding};
    if(opts.maxZoom != null) boundsOpts.maxZoom = opts.maxZoom;
    cam = App.map.cameraForBounds(b, boundsOpts);
  }catch(e){}
  if(!cam) return null;
  var zoom = cam.zoom + (opts.zoomBias || 0);
  var result = {center: cam.center, bearing: opts.bearing || 0, pitch: opts.pitch || 0};
  try{
    result.zoom = maxZoomFittingPoints(result, lngLats, opts.safePadding || defaultSafePadding(), zoom, cam.zoom - 3);
  }catch(e){
    // transform.cloneは内部API。万一失敗しても従来の「補正なし後がけ」にフォールバックする
    result.zoom = zoom;
  }
  return result;
};

var defaultSafePadding = function(){
  return window.innerWidth <= 760 ? App.viewPadding(16) : {top:60, left:60, right:60, bottom:80};
};

// baseCam(center/bearing/pitch)を固定し、全点がsafe内に投影される最大ズームを探す。
// terrain有効時はlocationPointにterrainを渡すと実投影(map.project)と一致する。
// tr.elevationはcloneの値をそのまま使う（上書きすると実投影とズレる）。
// 注意: 未ロード地点のDEMは標高0扱いになるため、カメラ移動前の予測は
// 山間部で甘くなる。移動後idleで再判定して補正する前提。
var maxZoomFittingPoints = function(baseCam, lngLats, safe, startZoom, minZoom){
  var tr = App.map.transform.clone();
  var terrain = App.map.terrain;
  tr.center = maplibregl.LngLat.convert(baseCam.center);
  tr.bearing = baseCam.bearing;
  tr.pitch = baseCam.pitch;
  var fits = function(z){
    tr.zoom = z;
    return lngLats.every(function(p){
      var pt = tr.locationPoint(maplibregl.LngLat.convert(p), terrain);
      return pt.x >= safe.left && pt.x <= tr.width - safe.right &&
             pt.y >= safe.top && pt.y <= tr.height - safe.bottom;
    });
  };
  var z = startZoom;
  while(z > minZoom && !fits(z)) z -= 0.2;
  return z;
};

App.fitBoundsZoomed = function(b, opts){
  try{
    var cam = App.map.cameraForBounds(b, opts);
    if(!cam){ App.map.fitBounds(b, opts); return; }
    App.map.flyTo({...cam, zoom:cam.zoom + FIT_ZOOM_EXTRA, duration:opts.duration||1200});
  }catch(e){
    try{ App.map.fitBounds(b, opts); }catch(e2){}
  }
};

App.cancelOrbit = function(){
  if(orbitRaf){ cancelAnimationFrame(orbitRaf); orbitRaf = null; }
};

App.orbitAround = function(center){
  App.cancelOrbit();
  var startBearing = App.map.getBearing();
  var t0 = null;
  var step = ts => {
    if(t0 === null) t0 = ts;
    var deg = (ts - t0)/1000 * ORBIT_DEG_PER_SEC;
    App.map.jumpTo({center, bearing: startBearing + deg});
    orbitRaf = deg < 360 ? requestAnimationFrame(step) : null;
  };
  orbitRaf = requestAnimationFrame(step);
};

App.flyToTouge = function(t){
  if(!t.poly.length) return;
  var st = t.poly[0], ed = t.poly[t.poly.length-1];
  var bearing = Math.atan2(ed[1]-st[1], ed[0]-st[0]) * 180 / Math.PI;
  var mobile = window.innerWidth <= 760;
  var maxZ = mobile ? 14 : 14.5;
  var b = new maplibregl.LngLatBounds();
  t.poly.forEach(p=>b.extend([p[1],p[0]]));
  App.cancelOrbit();
  var cam = App.map.cameraForBounds(b, {bearing, maxZoom:maxZ, padding:App.viewPadding(30)});
  var center = cam?.center ?? [t.center[1], t.center[0]];
  var to = maplibregl.LngLat.convert(center);
  var from = App.map.getCenter();
  var distKm = App.haversineKm(from.lat, from.lng, to.lat, to.lng);
  // 近距離のカード見比べは短く、遠距離ジャンプだけ長めに（essentialを付けずreduced-motion設定も尊重）
  var duration = Math.round(Math.min(1800, 500 + distKm * 25));
  App.map.flyTo({
    center: center,
    zoom: cam?.zoom ?? maxZ,
    pitch: mobile ? 64 : 70,
    bearing,
    duration: duration
  });
};

// 線・マーカー・ラベルのデータ更新のみ（カメラは動かさない）
App.updateVisitLine = function(userLatLng, t){
  App.placeLocMarker(userLatLng[1], userLatLng[0]);
  var st = t.poly[0];
  App.map.getSource("visit-line").setData({
    type:"Feature",
    geometry:{
      type:"LineString",
      coordinates:[[userLatLng[1],userLatLng[0]], [st[1],st[0]]]
    }
  });
  var distKm = App.haversineKm(userLatLng[0], userLatLng[1], st[0], st[1]);
  var distLabel = distKm < 1 ? Math.round(distKm * 1000) + "m" : distKm.toFixed(1) + "km";
  var midLng = (userLatLng[1] + st[1]) / 2;
  var midLat = (userLatLng[0] + st[0]) / 2;
  if(App._visitDistMarker) App._visitDistMarker.remove();
  var el = document.createElement("div");
  el.className = "ring-label";
  el.style.fontSize = "12px";
  el.style.textShadow = "0 1px 3px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,.9), 0 0 16px rgba(0,0,0,.6)";
  el.textContent = distLabel;
  App._visitDistMarker = new maplibregl.Marker({element:el, anchor:"center"})
    .setLngLat([midLng, midLat]).addTo(App.map);
  if(App._visitNameMarker) App._visitNameMarker.remove();
  var nameEl = document.createElement("div");
  nameEl.className = "ring-label";
  nameEl.style.cssText = "font:500 11px 'Noto Sans JP',sans-serif;text-shadow:0 1px 3px rgba(0,0,0,1),0 0 8px rgba(0,0,0,.9),0 0 16px rgba(0,0,0,.6)";
  nameEl.textContent = t.name || "";
  App._visitNameMarker = new maplibregl.Marker({element:nameEl, anchor:"bottom", offset:[0,-8]})
    .setLngLat([st[1], st[0]]).addTo(App.map);
  var dlat = st[0] - userLatLng[0];
  var dlng = (st[1] - userLatLng[1]) * Math.cos(userLatLng[0] * Math.PI / 180);
  var bearing = Math.atan2(dlng, dlat) * 180 / Math.PI;
  if(App.map.getSource("visit-arrow")){
    App.map.getSource("visit-arrow").setData({
      type:"Feature",
      properties:{bearing: bearing},
      geometry:{type:"Point", coordinates:[st[1], st[0]]}
    });
  }
  return bearing;
};

// データ更新 + カメラ移動（durationで補正時の短縮に対応）
var visitCamSeq = 0;
App.showVisitLine = function(userLatLng, t, duration){
  var bearing = App.updateVisitLine(userLatLng, t);
  var st = t.poly[0];
  var pullback = 0.03;
  var behindLat = userLatLng[0] - pullback * (st[0] - userLatLng[0]);
  var behindLng = userLatLng[1] - pullback * (st[1] - userLatLng[1]);
  App.cancelOrbit();
  var pts = [[behindLng, behindLat], [userLatLng[1], userLatLng[0]], [st[1], st[0]]];
  // 訪問確認ダイアログ表示中はその実高さ分だけ下を空け、現在地・破線がシートに隠れないようにする
  var vcOverlay = document.getElementById("visitConfirm");
  var vcSheet = vcOverlay && vcOverlay.classList.contains("show") ? vcOverlay.querySelector(".visit-confirm") : null;
  var dialogH = vcSheet ? vcSheet.offsetHeight : 0;
  var pad = App.viewPadding(20);
  pad.bottom = Math.max(pad.bottom + 120, dialogH ? dialogH + 40 : 0);
  var safe = defaultSafePadding();
  if(dialogH) safe.bottom = Math.max(safe.bottom, dialogH + 24);
  var cam = App.cameraForPointsPitched(pts, {
    padding: pad,
    bearing: bearing,
    pitch: 65,
    zoomBias: 1.6,
    safePadding: safe
  });
  var seq = ++visitCamSeq;
  setTimeout(function(){
    App.map.flyTo(cam
      ? {...cam, duration: duration || 1400}
      : {center:[userLatLng[1], userLatLng[0]], zoom:13.5, pitch:65, bearing:bearing, duration:duration || 1400});
    // 移動前の判定は未ロード地点のDEM標高を0とみなすため、山間部では両端が
    // まだ画面外に残ることがある。タイルが揃うidle後に再判定して一度だけ補正する。
    App.map.once("idle", function(){
      if(seq !== visitCamSeq) return;
      try{
        var live = {center: App.map.getCenter(), bearing: App.map.getBearing(), pitch: App.map.getPitch()};
        var cur = App.map.getZoom();
        var z = maxZoomFittingPoints(live, pts, safe, cur, cur - 3);
        if(z < cur - 0.05) App.map.easeTo({zoom: z, duration: 500});
      }catch(e){}
    });
  }, 100);
};

App.clearVisitLine = function(){
  if(App.map.getSource("visit-line")){
    App.map.getSource("visit-line").setData({type:"FeatureCollection",features:[]});
  }
  if(App.map.getSource("visit-arrow")){
    App.map.getSource("visit-arrow").setData({type:"FeatureCollection",features:[]});
  }
  if(App._visitDistMarker){ App._visitDistMarker.remove(); App._visitDistMarker = null; }
  if(App._visitNameMarker){ App._visitNameMarker.remove(); App._visitNameMarker = null; }
};

App._navCameraFired = false;

App.initialCamera = function(state){
  var action;
  switch(state){
    case INITIAL_CAM.NAV_RETURN:
      if(App._navCameraFired){ action = function(){}; break; }
      App._navCameraFired = true;
      var matched = App.lastRanked.find(function(t){ return t.stableKey === App.pendingVisitKey; });
      if(matched) App.pendingVisitTouge = matched;
      var navT = App.pendingVisitTouge;
      var savedLatLng = App.pendingVisitStartLatLng;
      action = function(){
        // 対象峠のカードを選択状態に（カメラは動かさないselectCardを使う。
        // シート状態はshowVisitLineのviewPadding計算に効くので先に確定させる）
        if(matched){
          var vcOpen = App.$("visitConfirm").classList.contains("show");
          // 確認ダイアログ表示中はリストシートを上げない（ボトムサーフェスは一枚）。閉じた時にカード表示へ
          if(vcOpen){
            App.selectCard(matched.id, true);
            App._vcPrevSheet = "card-peek";
          } else if(!App.restoreCardPeek(matched.id)){
            App.selectCard(matched.id, true);
            App.setSheet("card-peek");
          }
        }
        if(savedLatLng) App.showVisitLine(savedLatLng, navT);
        else App.flyToTouge(navT);
        // 高速設定（OSキャッシュ許可+Wi-Fi測位）で現在地を取り直し、線データだけ補正。
        // キャッシュ位置と300m以上ズレていた時のみ短いカメラ補正を入れる。
        navigator.geolocation.getCurrentPosition(function(pos){
          var fresh = [pos.coords.latitude, pos.coords.longitude];
          App.pendingVisitStartLatLng = fresh;
          App.saveDriving(App.pendingVisitKey, navT, fresh);
          if(!savedLatLng){ App.showVisitLine(fresh, navT); return; }
          App.updateVisitLine(fresh, navT);
          if(App.haversineKm(savedLatLng[0], savedLatLng[1], fresh[0], fresh[1]) >= 0.3){
            App.showVisitLine(fresh, navT, 600);
          }
        }, function(){}, {enableHighAccuracy:false, timeout:3000, maximumAge:60000});
      };
      break;
    case INITIAL_CAM.RESTORED:
    case INITIAL_CAM.FRESH:
      action = function(){
        var b = new maplibregl.LngLatBounds();
        App.lastRanked.forEach(function(t){ t.poly.forEach(function(p){ b.extend([p[1], p[0]]); }); });
        if(!b.isEmpty()) App.fitBoundsZoomed(b, {padding:App.viewPadding(65), pitch:55, bearing:-10, duration:1200});
      };
      break;
  }
  if(!action) return;
  if(App.mapReady) action();
  else App.map.once("load", action);
};

App.highlightOnMap = function(id){
  if(!App.mapReady) return;
  var hasSelection = id != null;
  var sel = ["==",["get","tid"], id ?? -9999];
  App.map.setFilter("touge-selected", sel);
  App.map.setPaintProperty("touge-line", "line-opacity",
    ["coalesce",["get","fade"],1]);
  App.map.setPaintProperty("touge-casing", "line-opacity",
    ["*",.9,["coalesce",["get","fade"],1]]);
};

App.drawRangeRings = function(lat, lng){
  if(!App.mapReady){ App.map.once("load", function(){ App.drawRangeRings(lat, lng); }); return; }
  var features = [];
  var labels = [];
  var latRad = lat*Math.PI/180;
  function circleCoords(radius, cw){
    var pts = [];
    for(var i = 0; i <= 128; i++){
      var j = cw ? i : (128 - i);
      var th = j/128 * 2*Math.PI;
      pts.push([
        lng + (radius*1000/(111320*Math.cos(latRad)))*Math.sin(th),
        lat + (radius*1000/111320)*Math.cos(th)
      ]);
    }
    return pts;
  }
  for(var r = 70; r >= 10; r -= 10){
    var coords = [circleCoords(r, false)];
    if(r > 10) coords.push(circleCoords(r - 10, true));
    features.push({type:"Feature",properties:{r},geometry:{type:"Polygon",coordinates:coords}});
    labels.push({r, pos:[lng, lat + r*1000/111320]});
  }
  App.map.getSource("rings").setData({type:"FeatureCollection",features});
  ringLabelMarkers.forEach(m=>m.remove());
  ringLabelMarkers = labels.map(l=>{
    var el = document.createElement("div");
    el.className = "ring-label";
    el.textContent = `${l.r}km`;
    el.style.color = "#fff";
    return new maplibregl.Marker({element:el, occludedOpacity:1}).setLngLat(l.pos).addTo(App.map);
  });
};
