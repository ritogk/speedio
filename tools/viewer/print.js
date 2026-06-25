// print.js — 印刷プレビュー
// Uses: App.$, App.closeMobileSearch, App.close3DView, App.has3DActive
// Provides: App.initPrint(), App.openPrintView(), App.closePrintView()
"use strict";

App.openPrintView = function(t){
  App.$("printName").textContent = t.name;
  App.$("printRouteLabel").textContent = t.routeLabel;
  App.$("printMeta").innerHTML = "全長 <b>"+t.lengthKm+"km</b> ・ 標高差 <b>"+t.height+"m</b>"
    + (t.unevennessCount != null ? " ・ 起伏 <b>"+t.unevennessCount+"回</b>" : "")
    + (t.buildingCnt != null ? " ・ 建物 <b>"+t.buildingCnt+"棟</b>" : "");
  App.$("printBars").innerHTML =
    '<span class="print-bars-label">コーナー '+(t.pctStrong+t.pctMedium+t.pctWeak)+'%</span>'
    + '<div class="stacked"><span style="width:'+t.pctStrong+'%;background:#FF453A"></span>'
    + '<span style="width:'+t.pctMedium+'%;background:#FF9F0A"></span>'
    + '<span style="width:'+t.pctWeak+'%;background:#30D158"></span>'
    + '<span style="width:'+t.pctStraight+'%;background:#98989D"></span></div>';
  var canvas = App.$("printCanvas");
  var dpr = 2;
  canvas.width = 760 * dpr;
  canvas.height = 500 * dpr;
  renderPrintCanvas(t, canvas, dpr);
  App.$("printOverlay").classList.add("show");
};

function renderPrintCanvas(t, canvas, dpr){
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var PAD = 40 * dpr;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  var secs = t.roadSection || [];
  var allPts = [];
  if(secs.length){
    secs.forEach(function(sec){ (sec.points||[]).forEach(function(p){ allPts.push(p); }); });
  }
  var usePoly = !allPts.length && t.poly.length >= 2;
  if(usePoly) t.poly.forEach(function(p){ allPts.push([p[1], p[0]]); });
  if(allPts.length < 2) return;
  var minLng=Infinity, maxLng=-Infinity, minLat=Infinity, maxLat=-Infinity;
  allPts.forEach(function(p){
    minLng = Math.min(minLng, p[0]); maxLng = Math.max(maxLng, p[0]);
    minLat = Math.min(minLat, p[1]); maxLat = Math.max(maxLat, p[1]);
  });
  var cosLat = Math.cos((minLat+maxLat)/2*Math.PI/180);
  var spanX = (maxLng-minLng)*cosLat || 1e-9;
  var spanY = (maxLat-minLat) || 1e-9;
  var scale = Math.min((W-PAD*2)/spanX, (H-PAD*2)/spanY);
  var cx = W/2, cy = H/2;
  var midLng = (minLng+maxLng)/2, midLat = (minLat+maxLat)/2;
  var toXY = function(lng, lat){ return [cx + (lng-midLng)*cosLat*scale, cy - (lat-midLat)*scale]; };
  var colors = {strong:'#FF453A', medium:'#FF9F0A', weak:'#30D158', straight:'#98989D', none:'#98989D'};
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#D8D8D8';
  ctx.lineWidth = 8 * dpr;
  if(secs.length){
    secs.forEach(function(sec){
      var pts = sec.points || [];
      if(pts.length < 2) return;
      ctx.beginPath();
      pts.forEach(function(p,i){ var xy=toXY(p[0],p[1]); i?ctx.lineTo(xy[0],xy[1]):ctx.moveTo(xy[0],xy[1]); });
      ctx.stroke();
    });
  }else{
    ctx.beginPath();
    t.poly.forEach(function(p,i){ var xy=toXY(p[1],p[0]); i?ctx.lineTo(xy[0],xy[1]):ctx.moveTo(xy[0],xy[1]); });
    ctx.stroke();
  }
  ctx.lineWidth = 5 * dpr;
  if(secs.length){
    secs.forEach(function(sec){
      var pts = sec.points || [];
      if(pts.length < 2) return;
      var lv = sec.section_type === 'straight' ? 'straight' : (sec.corner_level || 'weak');
      ctx.strokeStyle = colors[lv] || colors.straight;
      ctx.beginPath();
      pts.forEach(function(p,i){ var xy=toXY(p[0],p[1]); i?ctx.lineTo(xy[0],xy[1]):ctx.moveTo(xy[0],xy[1]); });
      ctx.stroke();
    });
  }else{
    ctx.strokeStyle = colors.weak;
    ctx.beginPath();
    t.poly.forEach(function(p,i){ var xy=toXY(p[1],p[0]); i?ctx.lineTo(xy[0],xy[1]):ctx.moveTo(xy[0],xy[1]); });
    ctx.stroke();
  }
}

App.closePrintView = function(){
  App.$("printOverlay").classList.remove("show");
};

App.initPrint = function(){
  App.$("closePrint").addEventListener("click", App.closePrintView);
  App.$("execPrint").addEventListener("click", function(){ window.print(); });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape"){
      if(App.$("mSearchOverlay").classList.contains("show")) App.closeMobileSearch();
      else if(App.$("printOverlay").classList.contains("show")) App.closePrintView();
      else if(App.has3DActive && App.has3DActive()) App.close3DView();
    }
  });
};
