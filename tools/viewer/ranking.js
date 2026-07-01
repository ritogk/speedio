// ranking.js — ランキング計算・カードHTML生成・サムネイル・ゴーストライン
// Uses: App.currentItems, App.currentPreset, App.map, App.$, App.BALANCE_WEIGHTS, App.calcBalanceScore
// Owns: App.lastRanked, App.searchQuery, App.visibleCount
// Provides: App.render(), App.renderAndFit(), App.rankedList(), App.renderCards(), App.revealAndSelect(), App.sampleElevations()
"use strict";

// File-local
var thumbCache = {};
var thumbObserver = null;
var ghostSvg, ghostPath, ghostPoly = null;

// ================= ランキング =================
App.rankedList = function(){
  if(App.currentPreset === "corner"){
    return [...App.currentItems]
      .map(t=>({...t,_s:t.pctStrong*3 + t.pctMedium*2 + t.pctWeak*1}))
      .sort((a,b)=>b._s-a._s);
  }
  if(App.currentPreset === "updown"){
    return [...App.currentItems]
      .map(t=>({...t,_s:t.scoreElevation ?? 0}))
      .sort((a,b)=>b._s-a._s);
  }
  if(App.currentPreset === "seclusion"){
    return [...App.currentItems]
      .map(t=>({...t,_s:t.buildingDensity!=null ? -t.buildingDensity : 1}))
      .sort((a,b)=>b._s-a._s);
  }
  if(App.currentPreset === "uphill"){
    return [...App.currentItems]
      .map(t=>({...t,_s:t.unevennessCount ?? 0}))
      .sort((a,b)=>b._s-a._s);
  }
  return [...App.currentItems]
    .map(t=>({...t,_s:App.calcBalanceScore(t, App.BALANCE_WEIGHTS)}))
    .sort((a,b)=>b._s-a._s);
};

App.visibleCount = App.PAGE_N;
App.searchQuery = "";
App.lastRanked = [];

// file-local
// 起伏ストリップ: elevation_unevenness_sectionsの登り/下り区間をルート上の位置に割り当て、
// hard-stopグラデーションにする（3Dビューの登り/下り配色と同色）。結果は峠ごとにキャッシュ。
var elevStripCache = {};
var ELEV_STRIP_COLORS = {0:"#DFE1E6", 1:"#E8553D", 2:"#4A90D9"}; // 平坦 / 登り / 下り
function elevStripCss(t){
  var key = t.stableKey || ("id" + t.id);
  if(elevStripCache[key] !== undefined) return elevStripCache[key];
  var pts = t.poly, es = t.elevSections;
  var result = null;
  if(pts.length > 1 && es && ((es.uphill && es.uphill.length) || (es.downhill && es.downhill.length))){
    var dirs = new Array(pts.length).fill(0);
    var assign = function(sections, code){
      (sections || []).forEach(function(sec){
        var si = 0, ei = pts.length - 1, bs = Infinity, be = Infinity;
        for(var i = 0; i < pts.length; i++){
          var ds = (pts[i][0]-sec.start[0])*(pts[i][0]-sec.start[0]) + (pts[i][1]-sec.start[1])*(pts[i][1]-sec.start[1]);
          var de = (pts[i][0]-sec.end[0])*(pts[i][0]-sec.end[0]) + (pts[i][1]-sec.end[1])*(pts[i][1]-sec.end[1]);
          if(ds < bs){ bs = ds; si = i; }
          if(de < be){ be = de; ei = i; }
        }
        if(si > ei){ var tmp = si; si = ei; ei = tmp; }
        for(var j = si; j <= ei; j++) dirs[j] = code;
      });
    };
    assign(es.uphill, 1);
    assign(es.downhill, 2);
    var stops = [], s = 0;
    for(var i = 1; i <= dirs.length; i++){
      if(i === dirs.length || dirs[i] !== dirs[s]){
        stops.push(ELEV_STRIP_COLORS[dirs[s]] + " " + (s/dirs.length*100).toFixed(1) + "% " + (i/dirs.length*100).toFixed(1) + "%");
        s = i;
      }
    }
    result = "linear-gradient(90deg," + stops.join(",") + ")";
  }
  elevStripCache[key] = result;
  return result;
}
App.elevStripCss = elevStripCss; // 訪問確認ダイアログのカードでも同じストリップを使う

function cardHtml(t, rank, total){
  var sv = App.streetViewUrl(t.poly);
  var isV = t.stableKey && App.visitedKeys.has(t.stableKey);
  var isF = t.stableKey && App.favoriteKeys.has(t.stableKey);
  var vd = isV ? App.visitedDates[t.stableKey] : null;
  var vLabel = vd ? Number(vd.slice(5,7)) + "/" + Number(vd.slice(8,10)) + " 走行" : null;
  var strip = elevStripCss(t);
  var tn = (t.tunnelSections||[]).length, br = (t.bridgeSections||[]).length;
  return '\
    <article class="card" data-id="'+t.id+'" tabindex="0">\
      <div class="card-top">\
        <div class="card-labels"><span class="rank-num">'+(rank+1)+'</span>'+(t.prefecture?'<span class="route-oval">'+App.escapeHtml(t.prefecture)+'</span>':(t._pref?'<span class="route-oval">'+App.escapeHtml(App.PREFECTURES[t._pref]||"")+'</span>':""))+(t.city?'<span class="route-oval">'+App.escapeHtml(t.city)+'</span>':"")+(t.distanceKm!=null?'<span class="dist-tag">\u{1F4CD}'+(t.distanceKm<10?t.distanceKm.toFixed(1):Math.round(t.distanceKm))+'km</span>':"")+'</div><h3 data-full="'+App.escapeHtml(t.name)+'">'+App.escapeHtml(t.name)+'</h3>\
      </div>\
      <p class="meta">距離 <b>'+t.lengthKm+'km</b> ・ 標高差 <b>'+t.height+'m</b> ・ 道幅 <span class="wgauge"><i style="width:'+Math.round((t.width||0)*100)+'%"></i></span></p>\
      <div class="bars">\
        <span class="bl">コーナー</span><div class="stacked"><span style="width:'+t.pctStrong+'%;background:var(--corner-strong)"></span><span style="width:'+t.pctMedium+'%;background:var(--corner-medium)"></span><span style="width:'+t.pctWeak+'%;background:var(--corner-weak)"></span><span style="width:'+t.pctStraight+'%;background:var(--straight)"></span></div><span class="bv">'+(t.pctStrong+t.pctMedium+t.pctWeak)+'%</span>\
        <span class="bl">起伏</span><div class="elev-strip"'+(strip?' style="background:'+strip+'"':'')+'></div><span class="bv elev-ud">'+(t.uphillCnt!=null?'<b class="u">↑'+t.uphillCnt+'</b><b class="d">↓'+(t.downhillCnt!=null?t.downhillCnt:0)+'</b>':'')+'</span>\
      </div>\
      <div class="card-tags">'+(vLabel?'<span class="visit-badge">\u{1F697} '+vLabel+'</span>':'')+(tn>0?'<span class="card-tag">トンネル <b>'+tn+'</b></span>':'')+(br>0?'<span class="card-tag">\u{1F309} ×'+br+'</span>':'')+(t.buildingCnt!=null?(t.buildingCnt>0?'<span class="card-tag">\u{1F3E0} ×'+t.buildingCnt+'</span>':'<span class="card-tag">\u{1F3E0} なし</span>'):"")+'</div>\
      <div class="card-actions">\
        <button class="btn primary" data-act="nav" data-id="'+t.id+'">\u{1F697} 行く</button>\
        '+(sv?'<a class="btn" href="'+sv+'" target="_blank" rel="noopener" data-act="link">\u{1F441} 路面</a>':"")+'\
        <button class="btn" data-act="3d"><svg style="width:14px;height:14px;vertical-align:-2px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L2 9l10 6 10-6-10-6z"/><path d="M2 15l10 6 10-6"/><path d="M2 9v6"/><path d="M22 9v6"/></svg> 3D</button>\
      </div>\
      <div class="rec-btns">\
        <button class="rec-btn'+(isF?' on-fav':'')+'" data-act="fav" aria-label="お気に入り">'+(isF?'★':'☆')+'</button>\
        <button class="rec-btn'+(isV?' on-visit':'')+'" data-act="visit" aria-label="走行済">\u{1F697}</button>\
      </div>\
      <div class="thumb" data-tid="'+t.id+'"><span class="thumb-spin"></span></div>\
    </article>';
}

// バーチャルスクロール: 画面に見えるカードだけDOMに生成する
var CARD_H = 0;
var CARD_GAP = 8;
var OVERSCAN_RATIO = 1;
var vsData = [];
var vsScrollBody = null;
var vsSpacer = null;
var vsContainer = null;
var vsRaf = null;
var vsActiveId = null;
var vsRenderedCards = {};

function vsCardsOffset(){
  return vsContainer.getBoundingClientRect().top
       - vsScrollBody.getBoundingClientRect().top
       + vsScrollBody.scrollTop;
}

function vsRender(){
  if(!vsScrollBody || !vsContainer || !vsData.length || !CARD_H) return;
  var offset = vsCardsOffset();
  var scrollTop = vsScrollBody.scrollTop;
  var viewH = vsScrollBody.clientHeight;
  var relTop = scrollTop - offset;
  var visibleN = Math.ceil(viewH / CARD_H);
  var overscan = Math.max(3, Math.round(visibleN * OVERSCAN_RATIO));
  var startIdx = Math.max(0, Math.floor(relTop / CARD_H) - overscan);
  var endIdx = Math.min(vsData.length, Math.ceil((relTop + viewH) / CARD_H) + overscan);

  var newRendered = {};
  var frag = document.createDocumentFragment();
  for(var i = startIdx; i < endIdx; i++){
    var o = vsData[i];
    var id = o.t.id;
    var existing = vsRenderedCards[id];
    if(existing){
      existing.style.top = (i * CARD_H) + "px";
      frag.appendChild(existing);
    } else {
      var div = document.createElement("div");
      div.innerHTML = cardHtml(o.t, o.rank, App.lastRanked.length);
      var card = div.firstElementChild;
      card.style.position = "absolute";
      card.style.left = "0";
      card.style.right = "0";
      card.style.top = (i * CARD_H) + "px";
      if(vsActiveId != null && id === vsActiveId) card.classList.add("active");
      frag.appendChild(card);
      if(thumbObserver){
        var thumb = card.querySelector(".thumb");
        if(thumb) thumbObserver.observe(thumb);
      }
      existing = card;
    }
    newRendered[id] = existing;
  }
  for(var key in vsRenderedCards){
    if(!newRendered[key]) vsRenderedCards[key].remove();
  }
  vsRenderedCards = newRendered;
  vsContainer.appendChild(frag);
}

function vsOnScroll(){
  if(vsRaf) return;
  vsRaf = requestAnimationFrame(function(){ vsRaf = null; vsRender(); });
}

App.renderCards = function(){
  var ranked = App.lastRanked;
  var q = App.searchQuery.trim().toLowerCase();
  var view = ranked.map(function(t,i){ return {t:t, rank:i}; });
  if(q) view = view.filter(function(o){
    return o.t.name.toLowerCase().includes(q) || o.t.routeLabel.toLowerCase().includes(q);
  });

  App.$("resultCount").textContent = q
    ? "検索ヒット "+view.length+"件"
    : "全"+view.length+"件";

  vsData = view;
  var container = App.$("cards");
  container.classList.add("thumbs");

  if(!vsSpacer){
    container.style.position = "relative";
    vsSpacer = document.createElement("div");
    vsSpacer.style.cssText = "width:1px;pointer-events:none";
    container.appendChild(vsSpacer);
    vsContainer = container;
    vsScrollBody = document.querySelector(".panel-body");
    vsScrollBody.addEventListener("scroll", vsOnScroll, {passive:true});
    container.addEventListener("click", function(e){
      if(e.target.closest('[data-act="link"]')) return;
      var card = e.target.closest(".card");
      if(!card) return;
      var id = Number(card.dataset.id);
      var list = App.lastRanked;
      var navBtn = e.target.closest('[data-act="nav"]');
      if(navBtn){
        e.stopPropagation();
        var t = list.find(function(x){ return x.id === id; });
        if(t) App.openNav(t);
        return;
      }
      if(e.target.closest('[data-act="visit"]')){
        e.stopPropagation();
        var t = list.find(function(x){ return x.id === id; });
        if(t && t.stableKey){
          if(App.visitedKeys.has(t.stableKey)) App.removeVisit(t.stableKey);
          else App.addVisit(t.stableKey);
          if(App.hideVisited || App.showOnlyVisited){ App.renderAndFit(); return; }
          var vBtn = e.target.closest('[data-act="visit"]');
          var isV = App.visitedKeys.has(t.stableKey);
          vBtn.classList.toggle("on-visit", isV);
          // 日付バッジも即時反映（次のrender待ちにしない）
          var card = vBtn.closest(".card");
          var badge = card.querySelector(".visit-badge");
          if(!isV && badge) badge.remove();
          if(isV && !badge){
            var vd = App.visitedDates[t.stableKey];
            if(vd){
              var b = document.createElement("span");
              b.className = "visit-badge";
              b.textContent = "\u{1F697} " + Number(vd.slice(5,7)) + "/" + Number(vd.slice(8,10)) + " 走行";
              card.querySelector(".card-tags").prepend(b);
            }
          }
        }
        return;
      }
      if(e.target.closest('[data-act="fav"]')){
        e.stopPropagation();
        var t = list.find(function(x){ return x.id === id; });
        if(t && t.stableKey){
          if(App.favoriteKeys.has(t.stableKey)) App.favoriteKeys.delete(t.stableKey);
          else App.favoriteKeys.add(t.stableKey);
          App.saveFavorites();
          if(App.showOnlyFavorites){ App.renderAndFit(); return; }
          var favBtn = e.target.closest('[data-act="fav"]');
          var isFav = App.favoriteKeys.has(t.stableKey);
          favBtn.textContent = isFav ? '★' : '☆';
          favBtn.classList.toggle("on-fav", isFav);
        }
        return;
      }
      if(e.target.closest('[data-act="3d"]')){
        var t = list.find(function(x){ return x.id === id; });
        if(t) App.open3DView(t);
        return;
      }
      var t = list.find(function(x){ return x.id === id; });
      if(!t) return;
      App.selectCard(t.id,true);
      App.setSheet("card-peek");
      App.flyToTouge(t);
    });
  }

  if(q && !view.length){
    for(var k in vsRenderedCards){ vsRenderedCards[k].remove(); }
    vsRenderedCards = {};
    container.querySelectorAll(".no-hit").forEach(function(el){ el.remove(); });
    container.insertAdjacentHTML("beforeend", '<p class="no-hit">「'+App.escapeHtml(App.searchQuery)+'」に一致する峠はありません</p>');
    vsSpacer.style.height = "0";
    return;
  }

  for(var k in vsRenderedCards){ vsRenderedCards[k].remove(); }
  vsRenderedCards = {};
  container.querySelectorAll(".no-hit").forEach(function(el){ el.remove(); });
  if(!container.contains(vsSpacer)) container.appendChild(vsSpacer);

  if(!CARD_H && view.length){
    var probe = document.createElement("div");
    probe.innerHTML = cardHtml(view[0].t, 0, view.length);
    var probeCard = probe.firstElementChild;
    probeCard.style.position = "absolute";
    probeCard.style.left = "0";
    probeCard.style.right = "0";
    probeCard.style.visibility = "hidden";
    container.appendChild(probeCard);
    CARD_H = probeCard.offsetHeight + CARD_GAP;
    probeCard.remove();
  }

  vsSpacer.style.height = (view.length * CARD_H) + "px";
  vsRender();
};

// ===== ルートサムネ =====
// 地理院の航空写真タイルを切り出し、ルート線を重ねたコース図をcanvasで生成する
// （実写街路画像は峠のカバレッジが乏しいため不採用。タイルは地図本体と同じ出典）

// thumbnail helpers - file-local
function lngLatToWorldPx(lng, lat, z){
  var scale = 256 * Math.pow(2, z);
  var s = Math.sin(lat * Math.PI/180);
  return [
    (lng + 180) / 360 * scale,
    (0.5 - Math.log((1+s)/(1-s)) / (4*Math.PI)) * scale
  ];
}
function loadTile(src){
  return new Promise(function(res, rej){
    var img = new Image();
    img.crossOrigin = "anonymous"; // canvasをdataURL化するために必要
    img.onload = function(){ res(img); };
    img.onerror = rej;
    img.src = src;
  });
}
function renderRouteThumb(t, W, H){
  var pts = t.poly; // [lat,lng]
  if(pts.length < 2) return Promise.resolve(null);
  var PAD = 12;
  var minLat=90, maxLat=-90, minLng=180, maxLng=-180;
  pts.forEach(function(p){
    minLat=Math.min(minLat,p[0]); maxLat=Math.max(maxLat,p[0]);
    minLng=Math.min(minLng,p[1]); maxLng=Math.max(maxLng,p[1]);
  });
  // ルートが「枠いっぱい−マージン」にぴったり収まる連続ズームを計算
  // （上部は3Dラインの浮き上がり分の余白を確保）
  var PAD_TOP = 40, PAD_BTM = 14;
  var K = 0.62; // 地面の前傾率（オブリーク投影: 縦をこの倍率に圧縮して奥に倒す）
  var tmp1 = lngLatToWorldPx(minLng, maxLat, 0);
  var ax = tmp1[0], ay = tmp1[1];
  var tmp2 = lngLatToWorldPx(maxLng, minLat, 0);
  var bx = tmp2[0], by = tmp2[1];
  var z = Math.min(16,
    Math.log2((W-2*PAD) / Math.max(bx-ax, 1e-9)),
    Math.log2(((H-PAD_TOP-PAD_BTM)/K) / Math.max(by-ay, 1e-9)));
  var p1 = lngLatToWorldPx(minLng, maxLat, z);
  var x1 = p1[0], y1 = p1[1];
  var p2 = lngLatToWorldPx(maxLng, minLat, z);
  var x2 = p2[0], y2 = p2[1];
  var Hw = Math.ceil(H / K); // 前傾前の地面キャンバスの高さ
  var ky = H / Hw;           // 実際の圧縮率
  var px0 = (x1+x2)/2 - W/2;
  var py0 = (y1+y2)/2 - (Hw + (PAD_TOP-PAD_BTM)/ky)/2; // ルート帯を下寄りに配置
  var cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  var ctx = cv.getContext("2d");
  // 地面（タイル+陰影+スモーク）は等倍のオフスクリーンに描き、最後に前傾させて貼る
  var ground = document.createElement("canvas");
  ground.width = W; ground.height = Hw;
  var gtx = ground.getContext("2d");
  gtx.fillStyle = "#171a17";
  gtx.fillRect(0, 0, W, Hw);
  // タイルは整数ズームで取得し、連続ズームへ縮小描画する
  var zt = Math.max(8, Math.min(13, Math.ceil(z)));
  var ts = 256 * Math.pow(2, z - zt); // 連続ズーム座標系でのタイル1枚のサイズ
  var tileList = [];
  for(var tx = Math.floor(px0/ts); tx <= Math.floor((px0+W)/ts); tx++){
    for(var ty = Math.floor(py0/ts); ty <= Math.floor((py0+Hw)/ts); ty++){
      tileList.push({tx: tx, ty: ty});
    }
  }
  // 航空写真 + 標高サンプリングを並行で取得
  return Promise.all([
    Promise.all(tileList.map(function(o){
      return loadTile("https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/"+zt+"/"+o.tx+"/"+o.ty+".jpg")
        .then(function(img){ return {img:img, tx:o.tx, ty:o.ty}; }).catch(function(){ return null; });
    })),
    App.sampleElevations(pts, 48).catch(function(){ return null; })
  ]).then(function(results){
    var photos = results[0], elevs = results[1];
    photos.filter(Boolean).forEach(function(o){ gtx.drawImage(o.img, o.tx*ts-px0, o.ty*ts-py0, ts, ts); });
    gtx.fillStyle = "rgba(8,10,8,.25)"; // 地図本体と同じくスモーク
    gtx.fillRect(0, 0, W, Hw);
    // 地面を前傾させて本体キャンバスへ
    ctx.drawImage(ground, 0, 0, W, Hw, 0, 0, W, H);
    // 3Dルートライン: 前傾した地表の影 + カーテン + 標高で浮かせた本線
    var N = 48;
    var pxy = []; // 前傾後の地表座標
    for(var i = 0; i < N; i++){
      var p = pts[Math.round(i*(pts.length-1)/(N-1))];
      var wp = lngLatToWorldPx(p[1], p[0], z);
      pxy.push([wp[0]-px0, (wp[1]-py0)*ky]);
    }
    var lift = null, norm = null;
    if(elevs && elevs.some(function(e){ return e !== 0; })){
      var mn = Math.min.apply(null, elevs);
      var span = Math.max(Math.max.apply(null, elevs) - mn, 1);
      var maxLift = Math.min(24, 6 + span/20); // 標高差が大きいほど高く浮かせる（上限24px）
      norm = elevs.map(function(e){ return (e-mn)/span; }); // 0=最低点, 1=最高点
      lift = norm.map(function(t){ return 4 + t*maxLift; });
    }
    ctx.lineJoin = ctx.lineCap = "round";
    var groundPath = function(){
      ctx.beginPath();
      pxy.forEach(function(xy,i){ i ? ctx.lineTo(xy[0],xy[1]) : ctx.moveTo(xy[0],xy[1]); });
    };
    // 影（地表のルート形状、ぼかして浮遊感を出す）
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.6)";
    ctx.shadowBlur = 4;
    groundPath();
    ctx.strokeStyle = "rgba(0,0,0,.5)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    if(lift){
      // 支柱を全点に立てて連続グラデーションの「色の壁」にする（標高: 青→シアン→緑→黄）
      ctx.lineWidth = 1.5;
      for(var i = 0; i < N; i++){
        var tVal = norm[i];
        ctx.strokeStyle = "hsla("+(218 - tVal*165)+", 95%, "+(52 + tVal*10)+"%, .6)";
        ctx.beginPath();
        ctx.moveTo(pxy[i][0], pxy[i][1]);
        ctx.lineTo(pxy[i][0], pxy[i][1]-lift[i]);
        ctx.stroke();
      }
      // 本線（標高分持ち上げた3Dライン、白縁+赤）
      var path3 = function(){
        ctx.beginPath();
        pxy.forEach(function(xy,i){ i ? ctx.lineTo(xy[0], xy[1]-lift[i]) : ctx.moveTo(xy[0], xy[1]-lift[i]); });
      };
      path3(); ctx.strokeStyle = "#fff";    ctx.lineWidth = 3.5; ctx.stroke();
      path3(); ctx.strokeStyle = "#E10600"; ctx.lineWidth = 2; ctx.stroke();
    }else{
      // 標高が取得できなかった場合は平面ラインのみ
      groundPath(); ctx.strokeStyle = "#fff";    ctx.lineWidth = 3.5; ctx.stroke();
      groundPath(); ctx.strokeStyle = "#E10600"; ctx.lineWidth = 2; ctx.stroke();
    }
    return cv.toDataURL("image/jpeg", .82);
  });
}

// ルート沿いの標高を地理院DEMタイル(dem_png)からサンプリングする
App.sampleElevations = function(pts, n){
  var zd = 12;
  var samples = [];
  for(var i = 0; i < n; i++){
    var p = pts[Math.round(i*(pts.length-1)/(n-1))];
    var wp = lngLatToWorldPx(p[1], p[0], zd);
    samples.push({key:Math.floor(wp[0]/256)+"/"+Math.floor(wp[1]/256), ox:Math.floor(wp[0])%256, oy:Math.floor(wp[1])%256});
  }
  var tiles = {};
  return Promise.all([...new Set(samples.map(function(s){ return s.key; }))].map(function(key){
    return loadTile("https://cyberjapandata.gsi.go.jp/xyz/dem_png/"+zd+"/"+key+".png").then(function(img){
      var c = document.createElement("canvas");
      c.width = c.height = 256;
      var cx = c.getContext("2d");
      cx.drawImage(img, 0, 0);
      tiles[key] = cx.getImageData(0, 0, 256, 256).data;
    }).catch(function(){ tiles[key] = null; });
  })).then(function(){
    return samples.map(function(s){
      var d = tiles[s.key];
      if(!d) return 0;
      var i = (s.oy*256 + s.ox)*4;
      var x = d[i]*65536 + d[i+1]*256 + d[i+2];
      if(x === 8388608) return 0; // 無効値
      return x < 8388608 ? x*0.01 : (x-16777216)*0.01;
    });
  });
};

var THUMB_MAX_CONCURRENT = 3;
var thumbActive = 0;
var thumbQueue = [];

function processThumbQueue(){
  while(thumbActive < THUMB_MAX_CONCURRENT && thumbQueue.length){
    var job = thumbQueue.shift();
    thumbActive++;
    job().then(function(){ thumbActive--; processThumbQueue(); });
  }
}

// 外部（訪問確認ダイアログ等）から同じキャッシュでルートサムネを取得する
App.getRouteThumb = function(t, w, h){
  if(thumbCache[t.id] === undefined){
    thumbCache[t.id] = renderRouteThumb(t, w, h).catch(function(){ return null; });
  }
  return Promise.resolve(thumbCache[t.id]);
};

function fillThumb(el){
  var tid = Number(el.dataset.tid);
  var t = App.lastRanked.find(function(x){ return x.id === tid; });
  if(!t) return;

  function doWork(){
    if(thumbCache[tid] === undefined){
      var w = (el.clientWidth || 84) * 2;
      var h = (el.clientHeight || 116) * 2;
      thumbCache[tid] = renderRouteThumb(t, w, h).catch(function(){ return null; });
    }
    return Promise.resolve(thumbCache[tid]).then(function(url){
      var live = document.querySelector('#cards .thumb[data-tid="'+tid+'"]');
      if(!live) return;
      if(url) live.innerHTML = '<img src="'+url+'" alt="コース形状">';
      else live.textContent = "—";
    });
  }

  thumbQueue.push(doWork);
  processThumbQueue();
}

App.render = function(){
  App.lastRanked = App.rankedList();
  if(App.userLatLng){
    App.lastRanked.forEach(function(t){
      t.distanceKm = App.haversineKm(App.userLatLng[0],App.userLatLng[1],t.center[0],t.center[1]);
    });
    if(App.currentPreset === "nearby"){
      App.lastRanked.sort(function(a,b){ return (a.distanceKm??Infinity)-(b.distanceKm??Infinity); });
    }
  }
  if(App.distanceFilter!=null && App.userLatLng){
    App.lastRanked = App.lastRanked.filter(function(t){ return t.distanceKm<=App.distanceFilter; });
  }
  if(App.widthFilter!=null){
    App.lastRanked = App.lastRanked.filter(function(t){ return t.width>=App.widthFilter; });
  }
  if(App.hideVisited){
    App.lastRanked = App.lastRanked.filter(function(t){ return !t.stableKey || !App.visitedKeys.has(t.stableKey); });
  }
  if(App.showOnlyVisited){
    App.lastRanked = App.lastRanked.filter(function(t){ return t.stableKey && App.visitedKeys.has(t.stableKey); });
  }
  if(App.showOnlyFavorites){
    App.lastRanked = App.lastRanked.filter(function(t){ return t.stableKey && App.favoriteKeys.has(t.stableKey); });
  }
  App.renderCards();
  var q = App.searchQuery.trim().toLowerCase();
  var mapList = q ? App.lastRanked.filter(function(t){ return t.name.toLowerCase().includes(q) || t.routeLabel.toLowerCase().includes(q); }) : App.lastRanked;
  App.drawMap(mapList);
};

App.renderAndFit = function(){
  App.render();
  var b = new maplibregl.LngLatBounds();
  App.lastRanked.forEach(function(t){ t.poly.forEach(function(p){ b.extend([p[1], p[0]]); }); });
  if(!b.isEmpty()) App.fitBoundsZoomed(b, {padding:App.viewPadding(65), pitch:55, bearing:-10, duration:1200});
};

// カードをリスト先頭にスクロールする共通処理
function vsScrollToCard(id, smooth){
  if(!vsScrollBody || !vsContainer || !CARD_H) return;
  var vsIdx = vsData.findIndex(function(o){ return o.t.id === id; });
  if(vsIdx < 0) return;
  var target = vsCardsOffset() + vsIdx * CARD_H;
  if(smooth){
    vsScrollBody.scrollTo({top: target, behavior:"smooth"});
  } else {
    vsScrollBody.scrollTop = target;
    vsRender();
  }
}

// 地図上のライン/マーカーから選んだとき、リスト側でそのカードまで開いて選択する
App.revealAndSelect = function(t){
  var rank = App.lastRanked.findIndex(function(x){ return x.id === t.id; });
  if(rank < 0) return;
  if(App.searchQuery){ App.searchQuery = ""; App.$("searchInput").value = ""; }
  App.renderCards();
  vsActiveId = t.id;
  vsScrollToCard(t.id, false);
  var card = document.querySelector('.card[data-id="'+t.id+'"]');
  if(card && App.isMobile()){
    var panel = App.$("panel");
    var h = App.$("sheetHandle").offsetHeight + card.offsetHeight + 14;
    panel.style.transform = "translateY(calc(100% - "+h+"px))";
    document.documentElement.style.setProperty("--card-peek-h", h);
  }
  App.highlightOnMap(t.id);
  App.setSheet("card-peek");
  App.flyToTouge(t);
};

App.selectCard = function(id, scroll){
  vsActiveId = id;
  document.querySelectorAll(".card.active").forEach(function(c){ c.classList.remove("active"); });
  var card = document.querySelector('.card[data-id="'+id+'"]');
  if(card) card.classList.add("active");
  if(card && App.isMobile()){
    var panel = App.$("panel");
    var h = App.$("sheetHandle").offsetHeight + card.offsetHeight + 14;
    panel.style.transform = "translateY(calc(100% - "+h+"px))";
    document.documentElement.style.setProperty("--card-peek-h", h);
  }
  if(scroll) vsScrollToCard(id, true);
  App.highlightOnMap(id);
};

// card-peek状態を選択カードから再構築する。
// setSheet("card-peek")はクラスを付けるだけで高さ(inline transform)を復元しないため、
// peek等から戻す時はこれを使う。カードが仮想リスト未描画でも同期スクロールで描画してから測る。
App.restoreCardPeek = function(id){
  var target = id != null ? id : vsActiveId;
  if(target == null) return false;
  vsActiveId = target;
  vsScrollToCard(target, false); // 同期スクロール+vsRenderでカードDOMを確定させる
  var card = document.querySelector('.card[data-id="'+target+'"]');
  if(!card) return false;
  App.selectCard(target, false); // active付与+transform/--card-peek-h再計算+地図ハイライト
  App.setSheet("card-peek");
  return true;
};

// 選択中の峠を地図上で強調（白グロー + 非選択を強フェード）
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

// ===== ゴーストライン =====
// 地形に貼り付くラインは山の陰に隠れるため、選択中の峠だけ
// SVGオーバーレイで全経路を破線でうっすら重ね、完全に隠れないようにする
var ghostListenerActive = false;

App.setGhost = function(poly){
  if(poly && poly.length > 1){
    var MAX = 240;
    if(poly.length <= MAX){ ghostPoly = poly; }
    else{
      var step = (poly.length-1)/(MAX-1);
      ghostPoly = Array.from({length:MAX}, function(_,i){ return poly[Math.round(i*step)]; });
    }
    if(!ghostListenerActive){
      App.map.on("render", App.drawGhost);
      ghostListenerActive = true;
    }
  }else{
    ghostPoly = null;
    ghostPath.setAttribute("d","");
    if(ghostListenerActive){
      App.map.off("render", App.drawGhost);
      ghostListenerActive = false;
    }
  }
  App.drawGhost();
};

App.drawGhost = function(){
  if(!ghostPoly){ ghostPath.setAttribute("d",""); return; }
  var W = App.map.getCanvas().width, H = App.map.getCanvas().height;
  var margin = Math.max(W, H) * 2;
  var d = "";
  var penDown = false;
  for(var i = 0; i < ghostPoly.length; i++){
    var p = App.map.project([ghostPoly[i][1], ghostPoly[i][0]]);
    var ok = p.x > -margin && p.x < W+margin && p.y > -margin && p.y < H+margin;
    if(!ok){ penDown = false; continue; }
    d += (penDown ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1);
    penDown = true;
  }
  ghostPath.setAttribute("d", d);
};

App.initRanking = function(){
  // Initialize thumbObserver
  if("IntersectionObserver" in window){
    thumbObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(!e.isIntersecting) return;
        thumbObserver.unobserve(e.target);
        fillThumb(e.target);
      });
    }, {root: document.querySelector(".panel-body"), rootMargin:"300px"});
  }

  // Initialize ghost SVG elements
  ghostSvg = document.getElementById("ghostLine");
  ghostPath = document.createElementNS("http://www.w3.org/2000/svg","path");
  ghostSvg.appendChild(ghostPath);
  ghostPoly = null;

  // drawGhostリスナーはsetGhost()で必要時のみ登録される

  var resizeTimer = null;
  window.addEventListener("resize", function(){
    if(resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function(){
      CARD_H = 0;
      if(vsData.length) App.renderCards();
    }, 200);
  });
};
