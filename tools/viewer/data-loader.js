// data-loader.js — 県データ・通行止め・観光・有料道路・号線の取得とキャッシュ
// Uses: App.map, App.mapReady, App.toViewModel, App.$, App.toast, App.showLoading, App.PREFECTURES
// Owns: App.currentItems, App.loadedPrefs
// Provides: App.switchPref(), App.fetchPrefItems(), App.fetchClosures(), App.renderClosureBanner(), etc.
(function(){
  var prefCache = {};
  var closureCache = {};
  var closureMarkers = [];
  var touristCache = {};
  var tollRoadCache = {};
  var tollGrid = null;
  var pendingClosures = null;
  var pendingTourists = null;
  var pendingTollRoads = null;
  var kobanCache = {};
  var routeNumCache = {};
  var pendingRouteNums = null;

  App.dataVersionChecked = false;
  App.dataVersionChanged = false;
  App.currentItems = [];
  App.widthFilter = 0.85;
  App.kobanVisible = false;
  App.touristVisible = false;
  App.tollVisible = false;
  App.loadedPrefs = new Set();

  App.checkDataVersion = async function(){
    if(App.dataVersionChecked) return;
    App.dataVersionChecked = true;
    try{
      const res = await fetch("./data-version.json", {cache:"no-store"});
      if(!res.ok) return;
      const {v} = await res.json();
      const prev = localStorage.getItem("touge.dataVersion");
      if(prev && prev !== v){
        App.dataVersionChanged = true;
        prefCache = {};
      }
      localStorage.setItem("touge.dataVersion", v);
    }catch(e){}
  };

  App.routeDedupeKey = function(vm){
    const gl = vm.poly || [];
    if(!gl.length) return null;
    const p1 = `${gl[0][0]},${gl[0][1]}`;
    const p2 = `${gl[gl.length-1][0]},${gl[gl.length-1][1]}`;
    const sorted = p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
    return `${vm.name}|${sorted}`;
  };

  App.dedupeItems = function(itemsArrays){
    const seen = new Set();
    return itemsArrays.flat().filter(function(t){
      const key = App.routeDedupeKey(t);
      if(!key) return true;
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  App.fetchPrefItems = async function(code){
    if(prefCache[code]) return prefCache[code];
    await App.checkDataVersion();
    try{
      const opts = App.dataVersionChanged ? {cache:"reload"} : {};
      const res = await fetch(`./targets/${code}/target.slim.json`, opts);
      if(!res.ok) return [];
      const raw = await res.json();
      const base = App.globalIdCounter;
      App.globalIdCounter += raw.length;
      const items = raw.map(function(r,i){ const vm = App.toViewModel(r, base + i); vm._pref = code; return vm; });
      prefCache[code] = items;
      return items;
    }catch(e){ return []; }
  };

  App.fetchClosures = async function(code){
    if(closureCache[code]) return closureCache[code];
    try{
      const res = await fetch(`./road_closures/${code}.json`);
      if(!res.ok) return [];
      const data = await res.json();
      closureCache[code] = data.closures || [];
      return closureCache[code];
    }catch(e){ return []; }
  };

  App.renderClosureBanner = function(){
    const codes = [...App.loadedPrefs];
    const all = codes.flatMap(function(c){ return (closureCache[c]||[]).map(function(cl){ return Object.assign({}, cl, {_pref:c}); }); });
    renderClosureMarkers(all);
  };

  function renderClosureMarkers(closures){
    closureMarkers.forEach(function(m){ m.remove(); });
    closureMarkers.length = 0;
    if(!App.mapReady){ pendingClosures = closures; return; }
    const withCoords = closures.filter(function(c){ return c.lat != null && c.lng != null; });
    if(!withCoords.length) return;

    const src = App.map.getSource("closures");
    const geojson = {
      type: "FeatureCollection",
      features: withCoords.map(function(c){
        return {
          type: "Feature",
          geometry: {type: "Point", coordinates: [c.lng, c.lat]},
          properties: {road: c.road||"", cause: c.cause||"", start_loc: c.start_loc||"", end_loc: c.end_loc||"", start_date: c.start_date||"", end_date: c.end_date||"未定"},
        };
      }),
    };
    if(src){ src.setData(geojson); }
    else{
      if(!App.map.hasImage("closure-icon")){
        const sz = 40, cv = document.createElement("canvas");
        cv.width = cv.height = sz;
        const cx = cv.getContext("2d");
        const r = sz/2;
        cx.shadowColor = "rgba(0,0,0,.4)";
        cx.shadowBlur = 2;
        cx.shadowOffsetY = 1;
        cx.beginPath(); cx.arc(r, r, r-3, 0, Math.PI*2);
        cx.fillStyle = "rgba(180,30,30,.75)"; cx.fill();
        cx.shadowColor = "transparent";
        cx.lineWidth = 2; cx.strokeStyle = "rgba(255,255,255,.5)"; cx.stroke();
        cx.lineWidth = 3; cx.lineCap = "round"; cx.strokeStyle = "#fff";
        cx.shadowColor = "rgba(0,0,0,.6)"; cx.shadowBlur = 1; cx.shadowOffsetX = 0; cx.shadowOffsetY = 0;
        const d = 5.5;
        cx.beginPath(); cx.moveTo(r-d, r-d); cx.lineTo(r+d, r+d); cx.stroke();
        cx.beginPath(); cx.moveTo(r+d, r-d); cx.lineTo(r-d, r+d); cx.stroke();
        App.map.addImage("closure-icon", {width:sz, height:sz, data:new Uint8Array(cx.getImageData(0,0,sz,sz).data)});
      }
      App.map.addSource("closures", {type:"geojson", data: geojson});
      App.map.addLayer({
        id: "closures-icon", type: "symbol", source: "closures",
        layout: {
          "icon-image": "closure-icon",
          "icon-size": ["interpolate",["linear"],["zoom"],5,0.3,10,0.45,14,0.6],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
    }
  }

  App.fetchTouristSpots = async function(code){
    if(touristCache[code]) return touristCache[code];
    try{
      const res = await fetch(`./tourism_spots/${code}.json`);
      if(!res.ok) return [];
      const data = await res.json();
      touristCache[code] = data.spots || [];
      return touristCache[code];
    }catch(e){ return []; }
  };

  App.renderTouristBanner = function(){
    const codes = [...App.loadedPrefs];
    const all = codes.flatMap(function(c){ return (touristCache[c]||[]).map(function(s){ return Object.assign({}, s, {_pref:c}); }); });
    App.renderTouristMarkers(all);
  };

  App.renderTouristMarkers = function(spots){
    if(!App.mapReady){ pendingTourists = spots; return; }
    const withCoords = spots.filter(function(s){ return s.lat != null && s.lng != null; });
    const src = App.map.getSource("tourists");
    const geojson = {
      type: "FeatureCollection",
      features: withCoords.map(function(s){
        return {
          type: "Feature",
          geometry: {type: "Point", coordinates: [s.lng, s.lat]},
          properties: {name: s.name||""},
        };
      }),
    };
    if(src){ src.setData(geojson); }
    else{
      if(!App.map.hasImage("tourist-icon")){
        const sz = 40, cv = document.createElement("canvas");
        cv.width = cv.height = sz;
        const cx = cv.getContext("2d");
        const r = sz/2;
        cx.shadowColor = "rgba(0,0,0,.4)"; cx.shadowBlur = 2; cx.shadowOffsetY = 1;
        cx.beginPath(); cx.arc(r, r, r-3, 0, Math.PI*2);
        cx.fillStyle = "rgba(25,118,210,.75)"; cx.fill();
        cx.shadowColor = "transparent";
        cx.lineWidth = 2; cx.strokeStyle = "rgba(255,255,255,.5)"; cx.stroke();
        cx.shadowColor = "rgba(0,0,0,.6)"; cx.shadowBlur = 1; cx.shadowOffsetX = 0; cx.shadowOffsetY = 0;
        cx.fillStyle = "#fff"; cx.font = "bold 18px sans-serif"; cx.textAlign = "center"; cx.textBaseline = "middle";
        cx.fillText("★", r, r+1);
        App.map.addImage("tourist-icon", {width:sz, height:sz, data:new Uint8Array(cx.getImageData(0,0,sz,sz).data)});
      }
      App.map.addSource("tourists", {type:"geojson", data: geojson});
      App.map.addLayer({
        id: "tourist-icon", type: "symbol", source: "tourists",
        layout: {
          "icon-image": "tourist-icon",
          "icon-size": ["interpolate",["linear"],["zoom"],5,0.25,10,0.4,14,0.55],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "visibility": App.touristVisible ? "visible" : "none",
        },
      });
    }
  };

  App.fetchTollRoads = async function(code){
    if(tollRoadCache[code]) return tollRoadCache[code];
    try{
      const res = await fetch(`./toll_roads/${code}.geojson`);
      if(!res.ok) return [];
      const data = await res.json();
      tollRoadCache[code] = data.features || [];
      return tollRoadCache[code];
    }catch(e){ return []; }
  };

  App.renderTollBanner = function(){
    const codes = [...App.loadedPrefs];
    const all = codes.flatMap(function(c){ return tollRoadCache[c]||[]; });
    tollGrid = App.buildLogisticsGrid(all);
    App.renderTollRoadLines(all);
    App.updateTollOverlapLayer();
  };

  App.updateTollOverlapLayer = function(){
    if(!App.mapReady) return;
    if(!App.tollVisible || !tollGrid){
      App.map.getSource("touge-toll").setData({type:"FeatureCollection",features:[]});
      return;
    }
    const td = App.map.getSource("touge")?._data;
    if(!td || !td.features) return;
    App.map.getSource("touge-toll").setData({type:"FeatureCollection",features:App.findOverlapSegments(td.features, tollGrid)});
  };

  App.renderTollRoadLines = function(features){
    if(!App.mapReady){ pendingTollRoads = features; return; }
    const vis = App.tollVisible ? "visible" : "none";
    const src = App.map.getSource("toll-roads");
    const geojson = {type: "FeatureCollection", features: features||[]};
    if(src){ src.setData(geojson); }
    else{
      App.map.addSource("toll-roads", {type:"geojson", data: geojson});
      App.map.addLayer({
        id: "toll-roads-casing", type: "line", source: "toll-roads",
        layout: {"line-cap":"round","line-join":"round","visibility":vis},
        paint: {
          "line-color": "#F57F17",
          "line-width": ["interpolate",["linear"],["zoom"],6,4,10,7,14,10],
          "line-opacity": .15,
        },
      });
      App.map.addLayer({
        id: "toll-roads-line", type: "line", source: "toll-roads",
        layout: {"line-cap":"round","line-join":"round","visibility":vis},
        paint: {
          "line-color": "#F57F17",
          "line-width": ["interpolate",["linear"],["zoom"],6,1.5,10,3,14,5],
          "line-opacity": .75,
          "line-dasharray": [6,3],
        },
      });
    }
  };

  // --- 号線レイヤー ---

  App.fetchRouteNumbers = async function(code){
    if(routeNumCache[code]) return routeNumCache[code];
    try{
      var res = await fetch("./route_numbers/" + code + ".geojson");
      if(!res.ok) return [];
      var data = await res.json();
      routeNumCache[code] = data.features || [];
      return routeNumCache[code];
    }catch(e){ return []; }
  };

  App.renderRouteNumBanner = function(){
    var codes = [...App.loadedPrefs];
    var all = codes.flatMap(function(c){ return routeNumCache[c] || []; });
    App.renderRouteNumLines(all);
  };

  App.updateRouteNumLayer = function(){
    if(!App.routeNumVisible) return;
    var codes = [...App.loadedPrefs];
    Promise.all(codes.map(function(c){ return App.fetchRouteNumbers(c); })).then(function(){ App.renderRouteNumBanner(); });
  };

  App.renderRouteNumLines = function(features){
    if(!App.mapReady){ pendingRouteNums = features; return; }
    var vis = App.routeNumVisible ? "visible" : "none";
    var src = App.map.getSource("route-numbers");
    var geojson = {type: "FeatureCollection", features: features || []};
    if(src){ src.setData(geojson); }
    else{
      App.map.addSource("route-numbers", {type:"geojson", data: geojson});
      var beforeLayer = "logistics-casing";
      App.map.addLayer({
        id: "route-numbers-casing", type: "line", source: "route-numbers",
        layout: {"line-cap":"round","line-join":"round","visibility":vis},
        paint: {
          "line-color": "#81D4FA",
          "line-width": ["interpolate",["linear"],["zoom"],6,3,10,6,14,8],
          "line-opacity": .2,
          "line-blur": ["interpolate",["linear"],["zoom"],6,2,10,3,14,4],
        },
      }, beforeLayer);
      App.map.addLayer({
        id: "route-numbers-line", type: "line", source: "route-numbers",
        layout: {"line-cap":"round","line-join":"round","visibility":vis},
        paint: {
          "line-color": "#FFFFFF",
          "line-width": ["interpolate",["linear"],["zoom"],6,0.3,10,0.8,14,1.2],
          "line-opacity": .7,
        },
      }, beforeLayer);
      App.map.addLayer({
        id: "route-numbers-label", type: "symbol", source: "route-numbers",
        layout: {
          "symbol-placement": "line",
          "text-field": ["get","label"],
          "text-size": ["interpolate",["linear"],["zoom"],8,8,14,11],
          "text-font": ["Open Sans Bold"],
          "text-max-angle": 30,
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "visibility": vis,
        },
        paint: {
          "text-color": "#0288D1",
          "text-halo-color": "rgba(255,255,255,0.9)",
          "text-halo-width": 1.5,
          "text-opacity": .6,
        },
      }, beforeLayer);
    }
  };

  App.kobanSpin = function(on){ return; // DISABLED
    const btn = document.getElementById("kobanToggle");
    if(!btn) return;
    const old = btn.querySelector(".ctrl-spin");
    if(old) old.remove();
    if(on) btn.insertAdjacentHTML("beforeend",' <span class="ctrl-spin"></span>');
  };

  App.fetchKoban = async function(code){ return; // DISABLED
    if(!App.mapReady) await new Promise(function(r){ App.map.once("load",r); });
    const name = App.PREFECTURES[code];
    if(!name) return;
    if(kobanCache[code]){
      App.map.getSource("koban").setData(kobanCache[code]);
      return;
    }
    App.kobanSpin(true);
    const query = `[out:json][timeout:30];area["name"="${name}"]["admin_level"="4"]->.pref;(node["amenity"="police"](area.pref);way["amenity"="police"](area.pref););out center;`;
    try{
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method:"POST", body:"data="+encodeURIComponent(query),
        headers:{"Content-Type":"application/x-www-form-urlencoded"}
      });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const features = data.elements
        .map(function(el){
          const lat = el.lat ?? el.center?.lat;
          const lon = el.lon ?? el.center?.lon;
          if(lat==null || lon==null) return null;
          return {type:"Feature",properties:{name:el.tags?.name||""},geometry:{type:"Point",coordinates:[lon,lat]}};
        })
        .filter(Boolean);
      const geojson = {type:"FeatureCollection", features};
      kobanCache[code] = geojson;
      if(App.kobanVisible) App.map.getSource("koban").setData(geojson);
    }catch(err){
      console.warn("[交番]", err.message);
      App.toast("交番データの取得に失敗しました");
    }finally{
      App.kobanSpin(false);
    }
  };

  // --- 県の読み込み ---

  App.saveFilter = function(){
    try{
      localStorage.setItem("touge.loadedPrefs", JSON.stringify([...App.loadedPrefs]));
      localStorage.setItem("touge.preset", App.currentPreset);
      if(App.distanceFilter!=null) localStorage.setItem("touge.distanceFilter", String(App.distanceFilter));
      else localStorage.removeItem("touge.distanceFilter");
      if(App.userLatLng) localStorage.setItem("touge.userLatLng", JSON.stringify(App.userLatLng));
    }catch(e){}
  };

  App.updatePrefLabel = function(){
    const names = [...App.loadedPrefs].sort().map(function(c){ return App.PREFECTURES[c]; }).filter(Boolean);
    App.$("prefName").textContent = names.length ? names.join("・") : "未選択";
    App.renderPrefTags();
    document.dispatchEvent(new CustomEvent("pref-changed"));
  };

  App.renderPrefTags = function(){
    const el = App.$("prefTags");
    const sel = App.$("prefSelect");
    el.querySelectorAll(".pref-tag").forEach(function(n){ n.remove(); });
    const sorted = [...App.loadedPrefs].sort();
    sorted.forEach(function(c){
      const span = document.createElement("span");
      span.className = "pref-tag";
      span.dataset.code = c;
      span.innerHTML = `${App.PREFECTURES[c]}<button class="pref-tag-x" data-code="${c}">✕</button>`;
      span.querySelector(".pref-tag-x").addEventListener("click", function(e){ e.stopPropagation(); App.removePref(c); });
      el.appendChild(span);
    });
  };

  App.removePref = function(code){
    App.loadedPrefs.delete(code);
    App.currentItems = App.currentItems.filter(function(t){ return t._pref !== code; });
    App.updatePrefLabel();
    App.$("prefSelect").value = "";
    App.saveFilter();
    App.renderClosureBanner();
    if(App.touristVisible) App.renderTouristBanner();
    if(App.tollVisible) App.renderTollBanner();
    if(App.routeNumVisible) App.renderRouteNumBanner();
    App.renderAndFit();
  };

  App.switchPref = async function(code, replace){
    if(replace === undefined) replace = true;
    if(!code) return;
    App.cancelOrbit();
    App.visibleCount = App.PAGE_N;
    App.searchQuery = "";
    App.$("searchInput").value = "";
    App.highlightOnMap(null);
    if(replace){
      App.loadedPrefs.clear();
    }
    App.loadedPrefs.add(code);
    App.updatePrefLabel();
    App.saveFilter();
    App.showLoading(true, `${App.PREFECTURES[code]}のデータを読み込み中…`);
    try{
      const [items] = await Promise.all([App.fetchPrefItems(code), App.fetchClosures(code)]);
      if(replace){
        App.currentItems = App.dedupeItems([items]);
      }else{
        App.currentItems = App.dedupeItems([App.currentItems, items]);
      }
      App.afterLoad(replace ? null : items);
    }catch(err){
      console.error(err);
      App.toast(`${App.PREFECTURES[code]}のデータを読み込めませんでした`);
      if(replace){ App.currentItems = []; }
      App.render();
    }finally{
      App.showLoading(false);
    }
  };

  App.afterLoad = function(focusItems){
    App.renderClosureBanner();
    if(App.touristVisible) App.updateTouristLayer();
    if(App.tollVisible) App.updateTollLayer();
    if(App.routeNumVisible) App.updateRouteNumLayer();
    App.render();
    const list = focusItems || App.rankedList();
    if(list.length){
      const doFit = function(){
        const b = new maplibregl.LngLatBounds();
        list.forEach(function(t){ t.poly.forEach(function(p){ b.extend([p[1], p[0]]); }); });
        App.fitBoundsZoomed(b, {padding:App.viewPadding(65), pitch:55, bearing:-10, duration:1200});
      };
      if(App.mapReady) doFit();
      else App.map.once("load", doFit);
    }
    if(window.innerWidth<=760) App.setSheet("half");
    if(App.kobanVisible){
      const code = App.$("prefSelect").value;
      if(code) App.fetchKoban(code);
    }
    App.updateLogisticsLayer();
  };

  // Flush pending layers once map is ready
  App._flushPendingDataLayers = function(){
    if(pendingClosures){ renderClosureMarkers(pendingClosures); pendingClosures = null; }
    if(pendingTourists){ App.renderTouristMarkers(pendingTourists); pendingTourists = null; }
    if(pendingTollRoads){ App.renderTollRoadLines(pendingTollRoads); pendingTollRoads = null; }
    if(pendingRouteNums){ App.renderRouteNumLines(pendingRouteNums); pendingRouteNums = null; }
  };
})();
