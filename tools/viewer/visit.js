// visit.js — 訪問記録・お気に入り・ドライブ状態管理
// Uses: App.$, App.toast, App.escapeHtml, App.PREFECTURES, App.render, App.bumpIcons, App.BUMP_SVG
// Provides: App.initVisit(), App.saveVisited(), App.saveFavorites(), App.commitPendingVisit(), App.showVisitConfirm()
"use strict";

/* ── shared state (exposed on App so nav.js etc. can access) ── */
App.pendingVisitKey = null;
App.pendingVisitTouge = null;
App.pendingVisitTs = 0;
App.pendingVisitStartLatLng = null;

/* ── persistence ── */
App.saveVisited = function(){ localStorage.setItem("touge.visited", JSON.stringify([...App.visitedKeys])); };
App.saveFavorites = function(){ localStorage.setItem("touge.favorites", JSON.stringify([...App.favoriteKeys])); };
App.updateVisitedUi = function(){};

/* ── driving state ── */
App.saveDriving = function(key, t, startLatLng){
  localStorage.setItem("touge.driving", JSON.stringify({
    stableKey:key, touge:t, ts:Date.now(),
    startLatLng: startLatLng || App.pendingVisitStartLatLng || null
  }));
};
App.clearDriving = function(){ localStorage.removeItem("touge.driving"); };
App.restoreDriving = function(){
  var raw = localStorage.getItem("touge.driving");
  if(!raw) return;
  try{
    var d = JSON.parse(raw);
    if(d.stableKey && d.touge){
      App.pendingVisitKey = d.stableKey;
      App.pendingVisitTouge = d.touge;
      App.pendingVisitTs = d.ts || Date.now();
      App.pendingVisitStartLatLng = d.startLatLng || null;
    }
  }catch(e){}
};

/* ── visit commit / clear ── */
App.commitPendingVisit = function(){
  if(!App.pendingVisitKey) return;
  App.visitedKeys.add(App.pendingVisitKey);
  App.saveVisited();
  App.visitedDates[App.pendingVisitKey] = App.todayStr;
  localStorage.setItem("touge.visitedDates", JSON.stringify(App.visitedDates));
  App.updateVisitedUi();
  App.clearDriving();
  App.toast("行った峠に記録しました");
  App.pendingVisitKey = null;
  App.pendingVisitTouge = null;
  App.pendingVisitTs = 0;
  App.pendingVisitStartLatLng = null;
  App.render();
};

App.clearPendingVisit = function(){
  App.clearDriving();
  App.pendingVisitKey = null;
  App.pendingVisitTouge = null;
  App.pendingVisitTs = 0;
  App.pendingVisitStartLatLng = null;
};

App.commitDriving = function(){
  if(!App.pendingVisitKey || !App.pendingVisitTouge) return;
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(function(pos){
      App.pendingVisitStartLatLng = [pos.coords.latitude, pos.coords.longitude];
      App.saveDriving(App.pendingVisitKey, App.pendingVisitTouge, App.pendingVisitStartLatLng);
    }, function(){
      App.saveDriving(App.pendingVisitKey, App.pendingVisitTouge);
    }, {enableHighAccuracy:true, timeout:10000, maximumAge:0});
  } else {
    App.saveDriving(App.pendingVisitKey, App.pendingVisitTouge);
  }
  App.pendingVisitTs = Date.now();
};

/* ── visit confirm card ── */
App.visitConfirmCardHtml = function(t){
  return '<article class="card">' +
    '<div class="card-top">' +
      '<div class="card-labels">' + (t.prefecture ? '<span class="route-oval">' + App.escapeHtml(t.prefecture) + '</span>' : (t._pref ? '<span class="route-oval">' + App.escapeHtml(App.PREFECTURES[t._pref] || "") + '</span>' : "")) + (t.city ? '<span class="route-oval">' + App.escapeHtml(t.city) + '</span>' : "") + '</div>' +
      '<h3>' + App.escapeHtml(t.name) + '</h3>' +
    '</div>' +
    '<p class="meta">全長 <b>' + t.lengthKm + 'km</b> ・ 標高差 <b>' + t.height + 'm</b></p>' +
    '<div class="bars">' +
      '<span class="bl">コーナー</span><div class="stacked"><span style="width:' + t.pctStrong + '%;background:var(--corner-strong)"></span><span style="width:' + t.pctMedium + '%;background:var(--corner-medium)"></span><span style="width:' + t.pctWeak + '%;background:var(--corner-weak)"></span><span style="width:' + t.pctStraight + '%;background:var(--straight)"></span></div><span class="bv">' + (t.pctStrong + t.pctMedium + t.pctWeak) + '%</span>' +
      '<span class="bl">標高</span><div class="track"><div class="fill u" style="width:' + Math.round(t.updown * 100) + '%"></div></div><span class="bv">' + Math.round(t.updown * 100) + '</span>' +
    '</div>' +
    '<div class="card-tags">' + (t.unevennessCount != null ? (t.unevennessCount > 0 ? '<span class="card-tag">' + App.bumpIcons(t.unevennessCount) + '</span>' : '<span class="card-tag">' + App.BUMP_SVG + ' なし</span>') : "") + (t.buildingCnt != null ? (t.buildingCnt > 0 ? '<span class="card-tag">🏠 ×' + t.buildingCnt + '</span>' : '<span class="card-tag">🏠 なし</span>') : "") + '</div>' +
  '</article>';
};

App.showVisitConfirm = function(){
  if(!App.pendingVisitKey || !App.pendingVisitTouge) return;
  if(Date.now() - lastDialogShownAt < DIALOG_COOLDOWN_MS) return;
  lastDialogShownAt = Date.now();
  App.$("vcCard").innerHTML = App.visitConfirmCardHtml(App.pendingVisitTouge);
  App.$("vcTitle").textContent = "この峠に行きましたか？";
  App.$("vcStep1").style.display = "";
  App.$("vcStep2").style.display = "none";
  App.$("visitConfirm").classList.add("show");
  if(App.mapReady) App.flyToTouge(App.pendingVisitTouge);
};

App.closeVisitConfirm = function(){
  App.$("visitConfirm").classList.remove("show");
};

/* ── location-based visit check ── */
var MOVE_THRESHOLD_KM = 0.5;
var ROUND_TRIP_MS = 7200000; // 2h
var DIALOG_COOLDOWN_MS = 15000;
var lastDialogShownAt = 0;

App._checkVisitByLocation = function(){
  if(!App.pendingVisitKey || !App.pendingVisitTs) return;
  var start = App.pendingVisitStartLatLng;
  var elapsed = Date.now() - App.pendingVisitTs;
  if(!start || !navigator.geolocation){
    if(elapsed >= ROUND_TRIP_MS) App.showVisitConfirm();
    return;
  }
  navigator.geolocation.getCurrentPosition(function(pos){
    var dist = App.haversineKm(start[0], start[1], pos.coords.latitude, pos.coords.longitude);
    if(dist >= MOVE_THRESHOLD_KM || elapsed >= ROUND_TRIP_MS) App.showVisitConfirm();
  }, function(){
    if(elapsed >= ROUND_TRIP_MS) App.showVisitConfirm();
  }, {enableHighAccuracy:true, timeout:10000, maximumAge:0});
};

App.checkPendingVisitOnLoad = function(){
  if(!App.pendingVisitKey) return;
  App.showVisitConfirm();
};

/* ── init: DOM listeners + restore ── */
App.initVisit = function(){
  var vcStep2Key = null;

  App.$("vcYes").addEventListener("click", function(){
    var key = App.pendingVisitKey;
    App.commitPendingVisit();
    if(key && !App.favoriteKeys.has(key)){
      vcStep2Key = key;
      App.$("vcTitle").textContent = "記録しました！";
      App.$("vcStep1").style.display = "none";
      App.$("vcStep2").style.display = "";
    }else{
      App.closeVisitConfirm();
    }
  });

  App.$("vcFavYes").addEventListener("click", function(){
    if(vcStep2Key){
      App.favoriteKeys.add(vcStep2Key);
      App.saveFavorites();
      App.toast("お気に入りに追加しました");
    }
    vcStep2Key = null;
    App.closeVisitConfirm();
  });

  App.$("vcFavSkip").addEventListener("click", function(){
    vcStep2Key = null;
    App.closeVisitConfirm();
  });

  App.$("vcDriving").addEventListener("click", function(){ App.closeVisitConfirm(); App.commitDriving(); });
  App.$("vcNo").addEventListener("click", function(){ App.closeVisitConfirm(); App.clearPendingVisit(); });
  App.$("visitConfirm").addEventListener("click", function(e){ if(e.target === App.$("visitConfirm")){ vcStep2Key = null; App.closeVisitConfirm(); App.clearPendingVisit(); } });

  /* visibilitychange — save driving on hide, check location on return */
  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState === "hidden" && App.pendingVisitKey){
      App.pendingVisitTs = Date.now();
      App.saveDriving(App.pendingVisitKey, App.pendingVisitTouge);
    }
    if(document.visibilityState === "visible"){
      if(!App.pendingVisitKey) App.restoreDriving();
      App._checkVisitByLocation();
    }
  });

  /* restore any in-progress drive */
  App.restoreDriving();
};
