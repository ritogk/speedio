// nav.js — ナビアプリ選択UI・設定画面
// Uses: App.$, App.toast, App.userLatLng, App.googleMapUrl, App.yahooCarNaviUrl, App.isMobileDevice
// Provides: App.initNav(), App.openNav()
"use strict";

var NAV_KEY = "touge_nav_app";
var pendingNavTouge = null;
var NAV_LABELS = {google:"Google Maps", yahoo:"Yahoo!カーナビ"};

App.openNav = function(t){
  // 記録UIが無効(PC)なら走行状態を保存しない = 後で「行った?」ダイアログも出ない
  if(t.stableKey && App.recordUiEnabled()){
    App.pendingVisitKey = t.stableKey;
    App.pendingVisitTouge = t;
    App.pendingVisitTs = 0;
    App.pendingVisitStartLatLng = App.userLatLng ? [App.userLatLng[0], App.userLatLng[1]] : null;
    App.saveDriving(t.stableKey, t, App.pendingVisitStartLatLng);
    App.updateDrivingChip();
    // 「行く」押下時点で走行ビュー（現在地→ST破線+カメラ）を描画しておく。
    // ナビから戻った時には既に見えている状態になる（PCはリロードされないのでここが唯一の描画機会）
    if(App.pendingVisitStartLatLng) App.showVisitLine(App.pendingVisitStartLatLng, t);
    if(!App.pendingVisitStartLatLng && navigator.geolocation){
      navigator.geolocation.getCurrentPosition(function(pos){
        if(!App.pendingVisitKey) return; // 取得中に✕等で解除されたら何もしない
        App.pendingVisitStartLatLng = [pos.coords.latitude, pos.coords.longitude];
        App.saveDriving(App.pendingVisitKey, App.pendingVisitTouge, App.pendingVisitStartLatLng);
        App.showVisitLine(App.pendingVisitStartLatLng, App.pendingVisitTouge);
      }, function(){}, {enableHighAccuracy:false, timeout:10000, maximumAge:60000});
    }
  }
  if(!App.isMobileDevice){
    window.open(App.googleMapUrl(t.poly, App.userLatLng?.[0], App.userLatLng?.[1]), "_blank");
    return;
  }
  var saved = localStorage.getItem(NAV_KEY);
  if(saved){
    launchNav(saved, t);
    return;
  }
  pendingNavTouge = t;
  App.$("navPicker").classList.add("show");
};

function launchNav(app, t){
  if(app === "yahoo"){
    var now = Date.now();
    window.location.href = App.yahooCarNaviUrl(t.poly, App.userLatLng?.[0], App.userLatLng?.[1]);
    setTimeout(function(){
      if(Date.now() - now < 2000) App.toast("Yahoo! カーナビアプリをインストールしてください", "error");
    }, 1500);
  } else {
    var url = App.googleMapUrl(t.poly, App.userLatLng?.[0], App.userLatLng?.[1]);
    if(App.isMobileDevice) window.location.href = url;
    else window.open(url, "_blank");
  }
}

function closeNavPicker(){ App.$("navPicker").classList.remove("show"); pendingNavTouge = null; }

// 設定画面
function openSettings(){
  var saved = localStorage.getItem(NAV_KEY);
  document.querySelectorAll(".settings-nav-opt").forEach(function(b){
    b.classList.toggle("active", b.dataset.nav === saved);
  });
  App.$("settingsOverlay").classList.add("show");
}
function closeSettings(){ App.$("settingsOverlay").classList.remove("show"); }

App.initNav = function(){
  App.$("settingsBtn").addEventListener("click", openSettings);
  App.$("settingsClose").addEventListener("click", closeSettings);
  App.$("settingsOverlay").addEventListener("click", function(e){ if(e.target === App.$("settingsOverlay")) closeSettings(); });
  App.$("navOptions").addEventListener("click", function(e){
    var btn = e.target.closest("[data-nav]");
    if(!btn) return;
    var app = btn.dataset.nav;
    localStorage.setItem(NAV_KEY, app);
    document.querySelectorAll(".settings-nav-opt").forEach(function(b){ b.classList.toggle("active", b.dataset.nav === app); });
    closeSettings();
    App.toast("ナビアプリを " + NAV_LABELS[app] + " に設定しました");
  });

  App.$("navPicker").addEventListener("click", function(e){
    var btn = e.target.closest("[data-nav]");
    if(btn && pendingNavTouge){
      var app = btn.dataset.nav;
      if(App.$("navRemember").checked) localStorage.setItem(NAV_KEY, app);
      var t = pendingNavTouge;
      closeNavPicker();
      launchNav(app, t);
      return;
    }
    if(e.target === App.$("navPicker")) closeNavPicker();
  });
  App.$("navCancel").addEventListener("click", closeNavPicker);
};
