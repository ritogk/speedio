// ui-events.js — PC/共通UIイベント・プリセット切替・レイヤートグル・ボトムシート
// Uses: App.map, App.$, App.render, App.switchPref, App.loadedPrefs, App.PREFECTURES
// Provides: App.initUI(), App.setSheet(), App.restoreFilter(), App.initialLoad(), App.updateLogisticsLayer()
(function(){
var App = window.App;
var $ = App.$;

/* ---- file-local state ---- */
var ringLabelMarkers = [];
var logisticsCache = {};
App.logisticsVisible = false;
var logisticsGrid = null;
var GRID_RES = 0.0002;
var ENDPOINT_RADIUS = 3;
App.closureVisible = true;
App.terrainEnabled = true;
var panel;

/* ---- isMobile ---- */
App.isMobile = function(){ return window.innerWidth <= 760; };

/* ---- App-level state ---- */
App.sheetState = "peek";
App.touristVisible = false;
App.tollVisible = false;
App.routeNumVisible = false;

/* ---- drawRangeRings ---- */
App.drawRangeRings = function(lat, lng){
  var map = App.map;
  if(!App.mapReady){ map.once("load", function(){ App.drawRangeRings(lat, lng); }); return; }
  var features = [];
  var labels = [];
  var latRad = lat * Math.PI / 180;
  function circleCoords(radius, cw){
    var pts = [];
    for(var i = 0; i <= 128; i++){
      var j = cw ? i : (128 - i);
      var th = j / 128 * 2 * Math.PI;
      pts.push([
        lng + (radius * 1000 / (111320 * Math.cos(latRad))) * Math.sin(th),
        lat + (radius * 1000 / 111320) * Math.cos(th)
      ]);
    }
    return pts;
  }
  for(var r = 70; r >= 10; r -= 10){
    var coords = [circleCoords(r, false)];
    if(r > 10) coords.push(circleCoords(r - 10, true));
    features.push({type:"Feature",properties:{r:r},geometry:{type:"Polygon",coordinates:coords}});
    labels.push({r:r, pos:[lng, lat + r * 1000 / 111320]});
  }
  map.getSource("rings").setData({type:"FeatureCollection",features:features});
  ringLabelMarkers.forEach(function(m){ m.remove(); });
  ringLabelMarkers = labels.map(function(l){
    var el = document.createElement("div");
    el.className = "ring-label";
    el.textContent = l.r + "km";
    el.style.color = "#fff";
    return new maplibregl.Marker({element:el, occludedOpacity:1}).setLngLat(l.pos).addTo(map);
  });
};

/* ---- logistics grid helpers (shared with toll) ---- */
App.buildLogisticsGrid = function(features){
  var grid = new Map();
  function _set(lng, lat, cat){
    var k = Math.round(lng / GRID_RES) + "," + Math.round(lat / GRID_RES);
    var prev = grid.get(k);
    if(!prev) grid.set(k, cat);
    else if(cat < prev) grid.set(k, cat);
  }
  features.forEach(function(f){
    var cat = f.properties.cat || 2;
    var c = f.geometry.coordinates;
    for(var i = 0; i < c.length - 1; i++){
      var dx = c[i+1][0] - c[i][0], dy = c[i+1][1] - c[i][1];
      var steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / GRID_RES));
      for(var s = 0; s <= steps; s++){
        var t = s / steps;
        _set(c[i][0] + dx * t, c[i][1] + dy * t, cat);
      }
    }
  });
  return grid;
};

function hitGrid(pt, grid, r){
  var gx = Math.round(pt[0] / GRID_RES), gy = Math.round(pt[1] / GRID_RES);
  var best = 0;
  for(var dx = -r; dx <= r; dx++)
    for(var dy = -r; dy <= r; dy++){
      var v = grid.get((gx + dx) + "," + (gy + dy));
      if(v && (!best || v < best)) best = v;
    }
  return best;
}

App.findOverlapSegments = function(tf, grid){
  if(!grid || !grid.size) return [];
  var out = [];
  tf.forEach(function(f){
    var c = f.geometry.coordinates;
    if(c.length < 2) return;
    var startCat = hitGrid(c[0], grid, ENDPOINT_RADIUS);
    var endCat = hitGrid(c[c.length - 1], grid, ENDPOINT_RADIUS);
    if(startCat && endCat){
      out.push({type:"Feature",properties:{cat:Math.min(startCat, endCat)},geometry:f.geometry});
    }
  });
  return out;
};

App.updateOverlapLayer = function(){
  if(!App.mapReady) return;
  if(!App.logisticsVisible || !logisticsGrid){
    App.map.getSource("touge-logistics").setData({type:"FeatureCollection",features:[]});
    return;
  }
  var td = App.map.getSource("touge") ? App.map.getSource("touge")._data : undefined;
  if(!td || !td.features) return;
  App.map.getSource("touge-logistics").setData({type:"FeatureCollection",features:App.findOverlapSegments(td.features, logisticsGrid)});
};

/* ---- fetchLogistics (file-local) ---- */
async function fetchLogistics(codes){
  var toFetch = codes.filter(function(c){ return !logisticsCache[c]; });
  if(toFetch.length) await Promise.all(toFetch.map(async function(c){
    try{
      var r = await fetch("./logistics/" + c + ".geojson");
      if(!r.ok) return;
      var d = await r.json();
      logisticsCache[c] = d.features;
    }catch(e){}
  }));
  var all = codes.filter(function(c){ return logisticsCache[c]; }).flatMap(function(c){ return logisticsCache[c]; });
  logisticsGrid = App.buildLogisticsGrid(all);
  if(App.mapReady) App.map.getSource("logistics").setData({type:"FeatureCollection",features:all});
  App.updateOverlapLayer();
}

App.updateLogisticsLayer = function(){
  if(!App.logisticsVisible) return;
  fetchLogistics([...App.loadedPrefs]);
};

/* ---- syncLegend ---- */
App.syncLegend = function(){
  document.querySelector(".legend-logistics").style.display = App.logisticsVisible ? "" : "none";
  document.querySelector(".legend-toll-line").style.display = App.tollVisible ? "" : "none";
  document.querySelector(".legend-toll-overlap").style.display = App.tollVisible ? "" : "none";
};

/* ---- updateTouristLayer / updateTollLayer ---- */
App.updateTouristLayer = function(){
  if(!App.touristVisible) return;
  var codes = [...App.loadedPrefs];
  Promise.all(codes.map(function(c){ return App.fetchTouristSpots(c); })).then(function(){ App.renderTouristBanner(); });
};

App.updateTollLayer = function(){
  if(!App.tollVisible) return;
  var codes = [...App.loadedPrefs];
  Promise.all(codes.map(function(c){ return App.fetchTollRoads(c); })).then(function(){ App.renderTollBanner(); });
};

/* ---- layer persistence ---- */
App.saveLayers = function(){
  var state = {
    terrain: App.terrainEnabled,
    koban: App.kobanVisible || false,
    logistics: App.logisticsVisible || false,
    closure: App.closureVisible !== false,
    tourist: App.touristVisible || false,
    toll: App.tollVisible || false,
    routeNum: App.routeNumVisible || false
  };
  localStorage.setItem("touge.layers", JSON.stringify(state));
};

/* ---- toggle helpers ---- */
App.toggleClosure = function(on){
  App.closureVisible = on;
  if(App.mapReady && App.map.getLayer("closures-icon")){
    App.map.setLayoutProperty("closures-icon", "visibility", on ? "visible" : "none");
  }
  App.syncLayerPopup();
};

App.toggleTourist = function(on){
  App.touristVisible = on;
  if(on) App.updateTouristLayer();
  if(App.mapReady && App.map.getLayer("tourist-icon")){
    App.map.setLayoutProperty("tourist-icon", "visibility", on ? "visible" : "none");
  }
  App.syncLayerPopup();
};

App.toggleToll = function(on){
  App.tollVisible = on;
  if(on) App.updateTollLayer();
  else{
    if(App.mapReady && App.map.getSource("toll-roads"))
      App.map.getSource("toll-roads").setData({type:"FeatureCollection",features:[]});
    App.updateTollOverlapLayer();
  }
  var vis = on ? "visible" : "none";
  ["toll-roads-casing","toll-roads-line"].forEach(function(id){
    if(App.mapReady && App.map.getLayer(id)) App.map.setLayoutProperty(id, "visibility", vis);
  });
  App.syncLegend();
  App.syncLayerPopup();
};

App.toggleRouteNum = function(on){
  App.routeNumVisible = on;
  if(on) App.updateRouteNumLayer();
  else{
    if(App.mapReady && App.map.getSource("route-numbers"))
      App.map.getSource("route-numbers").setData({type:"FeatureCollection",features:[]});
  }
  var vis = on ? "visible" : "none";
  ["route-numbers-casing","route-numbers-line","route-numbers-label"].forEach(function(id){
    if(App.mapReady && App.map.getLayer(id)) App.map.setLayoutProperty(id, "visibility", vis);
  });
  App.syncLayerPopup();
};

/* ---- terrain toggle ---- */
App.toggleTerrain = function(on){
  App.terrainEnabled = on;
  if(App.mapReady){
    App.map.setTerrain(on ? {source:"gsiTerrain", exaggeration:1.2} : null);
    if(on && App.map.getPitch() < 10) App.map.easeTo({pitch:55, duration:600});
  }
  App.syncLayerPopup();
  App.saveLayers();
};

/* ---- logistics toggle ---- */
App.toggleLogistics = function(on){
  App.logisticsVisible = on;
  var vis = on ? "visible" : "none";
  ["logistics-casing","logistics-main","logistics-alt"].forEach(function(id){
    if(App.mapReady && App.map.getLayer(id)) App.map.setLayoutProperty(id, "visibility", vis);
  });
  if(on) App.updateLogisticsLayer();
  else if(App.mapReady && App.map.getSource("logistics")){
    App.map.getSource("logistics").setData({type:"FeatureCollection",features:[]});
    App.updateOverlapLayer();
  }
  App.syncLegend();
  App.syncLayerPopup();
  App.saveLayers();
};

/* ---- koban toggle ---- */
App.toggleKoban = function(on){
  App.kobanVisible = on;
  if(App.mapReady && App.map.getLayer("koban-sym")){
    App.map.setLayoutProperty("koban-sym", "visibility", on ? "visible" : "none");
  }
  if(on){
    var code = document.getElementById("prefSelect").value;
    if(code) App.fetchKoban(code);
  }
  App.saveLayers();
};

/* ---- sync layer popup ---- */
App.syncLayerPopup = function(){
  document.getElementById("mLayer2d").classList.toggle("active", !App.terrainEnabled);
  document.getElementById("mLayer3d").classList.toggle("active", App.terrainEnabled);
  document.getElementById("mLayerLogistics").classList.toggle("active", App.logisticsVisible);
  document.getElementById("mLayerClosure").classList.toggle("active", App.closureVisible);
  document.getElementById("mLayerTourist").classList.toggle("active", App.touristVisible);
  document.getElementById("mLayerToll").classList.toggle("active", App.tollVisible);
  document.getElementById("mLayerRouteNum").classList.toggle("active", App.routeNumVisible);
};

/* ---- setSheet ---- */
App.setSheet = function(state){
  if(!App.isMobile()) return;
  App.sheetState = state;
  panel.classList.toggle("half", state === "half");
  panel.classList.toggle("card-peek", state === "card-peek");
  panel.classList.toggle("full", state === "full");
  if(state !== "card-peek") panel.style.transform = "";
};

/* ---- layer restore ---- */
// フラグ+ボタン状態の復元（map load不要、同期的に即実行）
App.restoreLayerFlags = function(){
  var savedLayers = null;
  try{ savedLayers = JSON.parse(localStorage.getItem("touge.layers")); }catch(e){}
  if(!savedLayers) return;
  if(savedLayers.terrain === false) App.terrainEnabled = false;
  if(savedLayers.logistics) App.logisticsVisible = true;
  if(savedLayers.closure === false) App.closureVisible = false;
  if(savedLayers.tourist) App.touristVisible = true;
  if(savedLayers.toll) App.tollVisible = true;
  if(savedLayers.routeNum) App.routeNumVisible = true;
  if(savedLayers.koban) App.kobanVisible = true;
  App.syncLayerPopup();
};
// マップレイヤーの実適用（map load後に実行）
App.restoreLayerMap = function(){
  var savedLayers = null;
  try{ savedLayers = JSON.parse(localStorage.getItem("touge.layers")); }catch(e){}
  if(!savedLayers) return;
  if(savedLayers.terrain){
    App.map.setTerrain({source:"gsiTerrain", exaggeration:1.2});
  }
  if(savedLayers.koban){
    if(App.map.getLayer("koban-sym")) App.map.setLayoutProperty("koban-sym", "visibility", "visible");
    var code = $("prefSelect").value;
    if(code) App.fetchKoban(code);
  }
  if(savedLayers.logistics){
    ["logistics-casing","logistics-main","logistics-alt"].forEach(function(id){
      if(App.map.getLayer(id)) App.map.setLayoutProperty(id, "visibility", "visible");
    });
    App.syncLegend();
  }
};

/* ---- restoreFilter ---- */
App.restoreFilter = async function(){
  try{
    var raw = localStorage.getItem("touge.loadedPrefs");
    if(!raw) return false;
    var codes = JSON.parse(raw).filter(function(c){ return App.PREFECTURES[c]; });
    if(!codes.length) return false;
    var savedPreset = localStorage.getItem("touge.preset");
    if(savedPreset && App.presetHints[savedPreset]){
      App.currentPreset = savedPreset;
      document.querySelectorAll(".presets .chip[data-preset]").forEach(function(c){ c.setAttribute("aria-pressed","false"); });
      var chip = document.querySelector('.chip[data-preset="' + savedPreset + '"]');
      if(chip) chip.setAttribute("aria-pressed","true");
      $("presetHint").textContent = App.presetHints[savedPreset];
    }
    var savedDist = localStorage.getItem("touge.distanceFilter");
    if(savedDist != null) App.distanceFilter = Number(savedDist);
    var savedLatLng = localStorage.getItem("touge.userLatLng");
    if(savedLatLng){
      App.userLatLng = JSON.parse(savedLatLng);
      App.placeLocMarker(App.userLatLng[1], App.userLatLng[0]);
      App.drawRangeRings(App.userLatLng[0], App.userLatLng[1]);
    }
    App.loadedPrefs.clear();
    codes.forEach(function(c){ App.loadedPrefs.add(c); });
    App.updatePrefLabel();
    App.showLoading(true, codes.length + "県のデータを復元中…");
    var results = await Promise.all(codes.map(function(c){ return App.fetchPrefItems(c); }));
    await Promise.all(codes.map(function(c){ return App.fetchClosures(c); }));
    App.currentItems = App.dedupeItems(results);
    App.showLoading(false);
    App.renderClosureBanner();
    if(App.touristVisible) App.updateTouristLayer();
    if(App.tollVisible) App.updateTollLayer();
    if(App.routeNumVisible) App.updateRouteNumLayer();
    App.render();
    App.updateLogisticsLayer();
    App.syncLegend();
    if(window.innerWidth <= 760) App.setSheet("half");
    App.initialCamera(App.pendingVisitKey ? INITIAL_CAM.NAV_RETURN : INITIAL_CAM.RESTORED);
    return true;
  }catch(e){ return false; }
};

/* ---- initialLoad ---- */
App.initialLoad = async function(){
  if(!navigator.geolocation) return;
  App.showLoading(true, "現在地を取得中…");
  navigator.geolocation.getCurrentPosition(
    async function(pos){
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      App.userLatLng = [lat, lng];
      App.placeLocMarker(lng, lat);
      App.drawRangeRings(lat, lng);
      var code = null;
      try{
        var ac = new AbortController();
        var tid = setTimeout(function(){ ac.abort(); }, 5000);
        var res = await fetch("https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=" + lat + "&lon=" + lng, {signal:ac.signal});
        clearTimeout(tid);
        if(res.ok){
          var data = await res.json();
          var muni = data && data.results && data.results.muniCd;
          if(muni) code = String(muni).padStart(5,"0").slice(0,2);
        }
      }catch(err){}
      if(code && App.PREFECTURES[code]){
        var codes = [code].concat(App.ADJACENT[code] || []);
        codes.forEach(function(c){ App.loadedPrefs.add(c); });
        App.updatePrefLabel();
        App.showLoading(true, "周辺" + codes.length + "県のデータを読み込み中…");
        var results = await Promise.all(codes.map(function(c){ return App.fetchPrefItems(c); }));
        await Promise.all(codes.map(function(c){ return App.fetchClosures(c); }));
        App.currentItems = App.dedupeItems(results);
        App.showLoading(false);
        App.toast(App.PREFECTURES[code] + "＋周辺" + (codes.length - 1) + "県を読み込みました");
        App.renderClosureBanner();
        if(App.touristVisible) App.updateTouristLayer();
        if(App.tollVisible) App.updateTollLayer();
        if(App.routeNumVisible) App.updateRouteNumLayer();
        App.saveFilter();
        App.render();
        App.updateLogisticsLayer();
        App.syncLegend();
        if(window.innerWidth <= 760) App.setSheet("half");
        App.initialCamera(App.pendingVisitKey ? INITIAL_CAM.NAV_RETURN : INITIAL_CAM.FRESH);
      }else{
        App.showLoading(false);
        App.toast("現在地の都道府県を判定できませんでした");
      }
    },
    function(){
      App.showLoading(false);
      App.toast("位置情報を取得できませんでした");
    },
    {enableHighAccuracy:true, timeout:10000, maximumAge:0}
  );
};

/* ================= initUI ================= */
App.initUI = function(){
  var map = App.map;
  panel = $("panel");
  var handle = $("sheetHandle");

  /* ---- prefSelect setup ---- */
  var sel = $("prefSelect");
  sel.innerHTML = '<option value="">＋ 県を追加</option><option value="nearby">周辺の県をまとめて</option>' +
    Object.entries(App.PREFECTURES).sort(function(a, b){ return a[0].localeCompare(b[0]); })
      .map(function(e){ return '<option value="' + e[0] + '">' + e[1] + '</option>'; }).join("");
  sel.addEventListener("change", function(e){
    var code = e.target.value;
    if(!code) return;
    sel.value = "";
    if(code === "nearby"){ App.loadNearbyPrefs(); return; }
    if(App.loadedPrefs.has(code)){
      App.toast(App.PREFECTURES[code] + "は読み込み済みです");
      return;
    }
    if(App.currentPreset === "nearby"){
      document.querySelectorAll(".presets .chip[data-preset]").forEach(function(c){ c.setAttribute("aria-pressed","false"); });
      document.querySelector('.chip[data-preset="balance"]').setAttribute("aria-pressed","true");
      App.currentPreset = "balance";
      App.distanceFilter = null;
      $("presetHint").textContent = App.presetHints.balance;
    }
    App.switchPref(code, App.loadedPrefs.size === 0);
  });
  {
    var m = document.createElement("span");
    m.style.cssText = "position:absolute;visibility:hidden;font:inherit;font-size:12px;font-weight:500;white-space:nowrap";
    m.textContent = "＋ 県を追加";
    document.body.appendChild(m);
    sel.style.width = (m.offsetWidth + 44) + "px";
    m.remove();
  }

  /* ---- loadNearbyPrefs ---- */
  App.loadNearbyPrefs = async function(){
    if(!navigator.geolocation){ App.toast("このブラウザは位置情報に対応していません"); return; }
    if(App.locatingBusy) return;
    App.locatingBusy = true;
    App.showLoading(true, "現在地を取得中…");
    var getPos = function(){
      return new Promise(function(resolve, reject){
        navigator.geolocation.getCurrentPosition(
          function(pos){
            var ll = [pos.coords.latitude, pos.coords.longitude];
            App.userLatLng = ll;
            App.placeLocMarker(ll[1], ll[0]);
            App.drawRangeRings(ll[0], ll[1]);
            resolve(ll);
          },
          reject,
          {enableHighAccuracy:true, timeout:10000, maximumAge:0}
        );
      });
    };
    var lat, lng;
    try{ var ll = await getPos(); lat = ll[0]; lng = ll[1]; }catch(e){ App.locatingBusy = false; App.showLoading(false); App.toast("位置情報を取得できませんでした"); return; }
    try{
      var code = null;
      try{
        var ac = new AbortController();
        var tid = setTimeout(function(){ ac.abort(); }, 5000);
        var res = await fetch("https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=" + lat + "&lon=" + lng, {signal:ac.signal});
        clearTimeout(tid);
        if(res.ok){
          var data = await res.json();
          var muni = data && data.results && data.results.muniCd;
          if(muni) code = String(muni).padStart(5,"0").slice(0,2);
        }
      }catch(err){}
      if(code && App.PREFECTURES[code]){
        var codes = [code].concat(App.ADJACENT[code] || []);
        App.loadedPrefs.clear();
        codes.forEach(function(c){ App.loadedPrefs.add(c); });
        App.updatePrefLabel();
        document.querySelectorAll(".presets .chip[data-preset]").forEach(function(c){ c.setAttribute("aria-pressed","false"); });
        document.querySelector('.chip[data-preset="balance"]').setAttribute("aria-pressed","true");
        App.currentPreset = "balance";
        App.distanceFilter = null;
        $("presetHint").textContent = App.presetHints.balance;
        App.saveFilter();
        App.showLoading(true, "周辺" + codes.length + "県のデータを読み込み中…");
        var results = await Promise.all(codes.map(function(c){ return App.fetchPrefItems(c); }));
        await Promise.all(codes.map(function(c){ return App.fetchClosures(c); }));
        App.currentItems = App.dedupeItems(results);
        App.showLoading(false);
        App.toast(App.PREFECTURES[code] + "＋周辺" + (codes.length - 1) + "県を読み込みました");
        App.renderClosureBanner();
        if(App.touristVisible) App.updateTouristLayer();
        if(App.tollVisible) App.updateTollLayer();
        App.render();
        App.updateLogisticsLayer();
        App.setSheet("half");
        var b = new maplibregl.LngLatBounds();
        App.lastRanked.forEach(function(t){ t.poly.forEach(function(p){ b.extend([p[1], p[0]]); }); });
        if(!b.isEmpty()) App.fitBoundsZoomed(b, {padding:App.viewPadding(65), pitch:55, bearing:-10, duration:1200});
        else map.flyTo({center:[lng, lat], zoom:9, pitch:55, bearing:-10, duration:1200});
      }else{
        App.showLoading(false);
        App.toast("現在地の都道府県を判定できませんでした");
        if(App.currentItems.length) App.render();
        map.flyTo({center:[lng, lat], zoom:9, pitch:55, bearing:-10, duration:1200});
      }
    }finally{ App.locatingBusy = false; }
  };

  /* ---- preset chip click ---- */
  document.querySelectorAll(".presets .chip[data-preset]").forEach(function(chip){
    chip.addEventListener("click", function(){
      var preset = chip.dataset.preset;
      if(preset === "nearby" && App.currentPreset !== "nearby"){
        if(!App.userLatLng){
          if(!navigator.geolocation){ App.toast("このブラウザは位置情報に対応していません"); return; }
          if(App.locatingBusy) return;
          App.locatingBusy = true;
          App.showLoading(true, "現在地を取得中…");
          navigator.geolocation.getCurrentPosition(function(pos){
            var lat = pos.coords.latitude, lng = pos.coords.longitude;
            App.userLatLng = [lat, lng];
            App.saveFilter();
            App.placeLocMarker(lng, lat);
            App.drawRangeRings(lat, lng);
            App.locatingBusy = false;
            document.querySelectorAll(".presets .chip[data-preset]").forEach(function(c){ c.setAttribute("aria-pressed","false"); });
            chip.setAttribute("aria-pressed","true");
            App.currentPreset = "nearby";
            App.distanceFilter = 50;
            $("presetHint").textContent = App.presetHints.nearby;
            App.visibleCount = App.PAGE_N;
            App.saveFilter();
            App.showLoading(false);
            App.renderAndFit();
          }, function(){
            App.locatingBusy = false;
            App.showLoading(false);
            App.toast("位置情報を取得できませんでした");
          }, {enableHighAccuracy:true, timeout:10000, maximumAge:0});
          return;
        }
      }
      var isActive = chip.getAttribute("aria-pressed") === "true";
      document.querySelectorAll(".presets .chip[data-preset]").forEach(function(c){ c.setAttribute("aria-pressed","false"); });
      if(isActive){
        document.querySelector('.chip[data-preset="balance"]').setAttribute("aria-pressed","true");
        App.currentPreset = "balance";
        App.distanceFilter = null;
      }else{
        chip.setAttribute("aria-pressed","true");
        App.currentPreset = preset;
        App.distanceFilter = preset === "nearby" ? 50 : null;
      }
      App.saveFilter();
      $("presetHint").textContent = App.presetHints[App.currentPreset];
      App.visibleCount = App.PAGE_N;
      App.renderAndFit();
    });
  });

  /* ---- search input ---- */
  $("searchInput").addEventListener("input", function(e){
    App.searchQuery = e.target.value;
    App.render();
  });

  /* ---- hideVisited / showFavorites ---- */
  $("hideVisitedBtn").addEventListener("click", function(){
    App.hideVisited = !App.hideVisited;
    $("hideVisitedBtn").setAttribute("aria-pressed", App.hideVisited ? "true" : "false");
    App.renderAndFit();
  });
  $("showFavoritesBtn").addEventListener("click", function(){
    App.showOnlyFavorites = !App.showOnlyFavorites;
    $("showFavoritesBtn").setAttribute("aria-pressed", App.showOnlyFavorites ? "true" : "false");
    App.renderAndFit();
  });

  /* ---- chip-row scroll ---- */
  {
    var row = document.querySelector(".chip-row");
    var sec = document.querySelector(".presets");
    row.addEventListener("scroll", function(){
      var atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
      sec.classList.toggle("scrolled-end", atEnd);
    }, {passive:true});
  }
  {
    var row2 = $("prefTags");
    var wrap = $("prefTagsWrap");
    row2.addEventListener("scroll", function(){
      var atEnd = row2.scrollLeft + row2.clientWidth >= row2.scrollWidth - 4;
      wrap.classList.toggle("scrolled-end", atEnd);
    }, {passive:true});
  }

  /* ---- locateBtn ---- */
  var locatePinBusy = false;
  $("locateBtn").addEventListener("click", function(){
    if(!navigator.geolocation){ App.toast("このブラウザは位置情報に対応していません"); return; }
    if(locatePinBusy) return;
    locatePinBusy = true;
    App.showLoading(true, "現在地を取得中…");
    navigator.geolocation.getCurrentPosition(
      function(pos){
        locatePinBusy = false;
        var lat = pos.coords.latitude, lng = pos.coords.longitude;
        App.userLatLng = [lat, lng];
        App.saveFilter();
        App.placeLocMarker(lng, lat);
        App.drawRangeRings(lat, lng);
        App.cancelOrbit();
        map.flyTo({center:[lng, lat], zoom:11, pitch:55, bearing:0, padding:App.viewPadding(65), duration:1400, essential:true});
        App.showLoading(false);
        App.toast("現在地を更新しました");
        if(App.currentItems.length && App.currentPreset === "nearby") App.render();
      },
      function(){
        locatePinBusy = false;
        App.showLoading(false);
        App.toast("位置情報を取得できませんでした");
      },
      {enableHighAccuracy:true, timeout:10000, maximumAge:0}
    );
  });

  /* ---- holdRotate helper ---- */
  var holdHintShown = false;
  function holdRotate(btn, dir){
    var raf = null, t0 = 0;
    var step = function(){ map.setBearing(map.getBearing() + dir * 1.6); raf = requestAnimationFrame(step); };
    btn.addEventListener("pointerdown", function(e){
      e.preventDefault();
      t0 = performance.now();
      cancelAnimationFrame(raf);
      step();
    });
    var end = function(){
      if(!t0) return;
      cancelAnimationFrame(raf);
      if(performance.now() - t0 < 250){
        map.easeTo({bearing: map.getBearing() + dir * 45, duration:400});
        if(!holdHintShown){ holdHintShown = true; App.toast("回転ボタンは長押しでまわり続けます"); }
      }
      t0 = 0;
    };
    ["pointerup","pointerleave","pointercancel"].forEach(function(ev){ btn.addEventListener(ev, end); });
  }
  holdRotate($("rotL"), 1);
  holdRotate($("rotR"), -1);

  /* ---- bottom sheet ---- */
  handle.addEventListener("click", function(){
    if(!App.isMobile()) return;
    var next = App.sheetState === "peek" || App.sheetState === "card-peek" ? "half" : App.sheetState === "half" ? "full" : "peek";
    App.setSheet(next);
  });
  var dragStartY = null, dragStartState = null;
  handle.addEventListener("touchstart", function(e){
    dragStartY = e.touches[0].clientY;
    dragStartState = App.sheetState;
  }, {passive:true});
  handle.addEventListener("touchend", function(e){
    if(dragStartY === null) return;
    var dy = e.changedTouches[0].clientY - dragStartY;
    if(Math.abs(dy) > 40){
      var order = ["peek","half","full"];
      var idx = order.indexOf(dragStartState) + (dy < 0 ? 1 : -1);
      App.setSheet(order[Math.max(0, Math.min(2, idx))]);
    }
    dragStartY = null;
  });

  /* ---- PC panel drag scroll ---- */
  {
    var body = document.querySelector(".panel-body");
    var dragging = false, startY = 0, startScroll = 0, moved = false;
    body.addEventListener("mousedown", function(e){
      if(!App.isMobile() && e.button === 0){
        dragging = true; moved = false;
        startY = e.clientY; startScroll = body.scrollTop;
        body.style.cursor = "grab";
      }
    });
    window.addEventListener("mousemove", function(e){
      if(!dragging) return;
      var dy = e.clientY - startY;
      if(Math.abs(dy) > 4) moved = true;
      if(moved){
        body.scrollTop = startScroll - dy;
        body.style.cursor = "grabbing";
      }
    });
    window.addEventListener("mouseup", function(){
      if(!dragging) return;
      dragging = false;
      body.style.cursor = "";
    });
    body.addEventListener("click", function(e){
      if(moved) e.stopPropagation();
      moved = false;
    }, true);
  }

  /* ---- PC sidebar toggle ---- */
  $("sideHandle").addEventListener("click", function(){
    panel.classList.toggle("hidden-side");
    setTimeout(function(){ map.resize(); }, 280);
  });
  window.addEventListener("resize", function(){
    map.resize();
  });

  /* ---- header element rearrangement ---- */
  $("prefTags").prepend($("prefSelect"));

  /* ---- locate button proxies (mobile/PC) ---- */
  $("mLocateBtn").addEventListener("click", function(){ $("locateBtn").click(); });
  $("pcLocateBtn").addEventListener("click", function(){ $("locateBtn").click(); });

  /* ---- admin mode toggle (R-L-R-L-R-L sequence) ---- */
  {
    var ADMIN_KEY = "speedio_admin";
    var SEQ = ["R","L","R","L","R","L"];
    var progress = 0, seqTimer = null;
    var reset = function(){ progress = 0; clearTimeout(seqTimer); };
    ["rotR","rotL"].forEach(function(id){
      $(id).addEventListener("click", function(){
        var key = id === "rotR" ? "R" : "L";
        if(key === SEQ[progress]){
          progress++;
          clearTimeout(seqTimer);
          seqTimer = setTimeout(reset, 3000);
          if(progress >= SEQ.length){
            reset();
            var wp = $("adminPanel");
            var btn = $("adminToggleBtn");
            var on = !wp.classList.contains("show");
            if(on){
              wp.classList.add("show");
              btn.style.display = "";
            } else {
              wp.classList.remove("show");
              wp.classList.add("collapsed");
              btn.style.display = "none";
            }
            localStorage.setItem(ADMIN_KEY, on ? "1" : "0");
            App.toast(on ? "管理者モード ON" : "管理者モード OFF");
          }
        } else {
          reset();
        }
      });
    });
  }

  /* ---- filter bar scroll shadow ---- */
  {
    var bar = $("mFilterBar");
    var filterWrap = $("mFilterWrap");
    function updateFilterShadow(){
      filterWrap.classList.toggle("shadow-left", bar.scrollLeft > 4);
      filterWrap.classList.toggle("shadow-right", bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 4);
    }
    bar.addEventListener("scroll", updateFilterShadow, {passive:true});
    new ResizeObserver(updateFilterShadow).observe(bar);
    updateFilterShadow();
  }

  /* ---- prevent page scroll ---- */
  window.addEventListener("scroll", function(){
    if(window.scrollX || window.scrollY) window.scrollTo(0, 0);
  });

  /* ---- save on unload / visibility change ---- */
  window.addEventListener("beforeunload", function(){ App.saveFilter(); });
  document.addEventListener("visibilitychange", function(){ if(document.hidden) App.saveFilter(); });

};
})();
