// map-init.js — 地図初期化・レイヤー管理・描画
// Uses: App.$, App.escapeHtml, App.cssVar, App.tierOf, App.fadeOf, App.lastRanked, App.MARKER_N, App.visitedKeys
// Provides: App.initMap(), App.drawMap(), App.flyToTouge(), App.initialCamera(), App.fitBoundsZoomed(), App.viewPadding(), App.highlightOnMap(), App.cancelOrbit(), App.drawRangeRings()
"use strict";

const INITIAL_CAM = Object.freeze({
  FRESH:      "fresh",      // 初回訪問: 現在地周辺の峠bboxにフィット
  RESTORED:   "restored",   // セッション復元: フィルタ適用後の峠bboxにフィット
  NAV_RETURN: "nav-return"  // ナビから戻った: 対象峠にズーム
});

var markers = [];
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

  // ランクマーカー
  markers.forEach(m=>m.remove());
  markers = [];
  list.slice(0, App.MARKER_N).forEach((t,i)=>{
    var el = document.createElement("div");
    el.className = "rank-marker tier-" + App.tierOf(i, list.length);
    el.textContent = i+1;
    el.addEventListener("click",()=>App.revealAndSelect(t));
    var m = new maplibregl.Marker({element:el, occludedOpacity:1})
      .setLngLat([t.center[1], t.center[0]])
      .addTo(App.map);
    markers.push(m);
  });
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
  App.map.flyTo({
    center: cam?.center ?? [t.center[1], t.center[0]],
    zoom: cam?.zoom ?? maxZ,
    pitch: mobile ? 64 : 70,
    bearing,
    duration:1800,
    essential:true
  });
};

App.initialCamera = function(state){
  var action;
  switch(state){
    case INITIAL_CAM.NAV_RETURN:
      var matched = App.lastRanked.find(function(t){ return t.stableKey === App.pendingVisitKey; });
      action = function(){
        if(matched){
          App.pendingVisitTouge = matched;
          App.revealAndSelect(matched);
        }else{
          App.flyToTouge(App.pendingVisitTouge);
        }
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
