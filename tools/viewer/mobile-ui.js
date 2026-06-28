// mobile-ui.js — モバイル検索UI・フィルターバー・ソート・レイヤーポップアップ
// Uses: App.$, App.PREFECTURES, App.loadedPrefs, App.switchPref, App.render
// Provides: App.initMobileUI(), App.closeMobileSearch()

App.initMobileUI = function() {
  var REGIONS = [
    {name:"北海道", codes:["01"]},
    {name:"東北", codes:["02","03","04","05","06","07"]},
    {name:"関東", codes:["08","09","10","11","12","13","14"]},
    {name:"中部", codes:["15","16","17","18","19","20","21","22","23"]},
    {name:"関西", codes:["24","25","26","27","28","29","30"]},
    {name:"中国", codes:["31","32","33","34","35"]},
    {name:"四国", codes:["36","37","38","39"]},
    {name:"九州・沖縄", codes:["40","41","42","43","44","45","46","47"]}
  ];

  var overlay = App.$("mSearchOverlay");
  var soInput = App.$("mSoInput");
  var soResults = App.$("mSoResults");
  var prefGrid = App.$("mSoPrefGrid");
  var pill = App.$("mSearchPill");
  var filterBar = App.$("mFilterBar");

  // 地域グループ都道府県グリッドを構築
  REGIONS.forEach(function(region) {
    var group = document.createElement("div");
    group.className = "m-region-group";
    group.innerHTML = '<div class="m-region-title">' + region.name + '</div>';
    var grid = document.createElement("div");
    grid.className = "m-pref-grid";
    region.codes.forEach(function(code) {
      var btn = document.createElement("button");
      btn.className = "m-pref-chip";
      btn.dataset.code = code;
      btn.textContent = App.PREFECTURES[code].replace(/[県府都]$/, "");
      btn.addEventListener("click", function() {
        if(App.loadedPrefs.has(code)){
          App.removePref(code);
          btn.classList.remove("selected");
        }else{
          App.switchPref(code, App.loadedPrefs.size === 0);
          btn.classList.add("selected");
        }
        syncMobilePrefState();
      });
      grid.appendChild(btn);
    });
    group.appendChild(grid);
    prefGrid.appendChild(group);
  });

  // === 地図上フィルターバー（フィルターのみ） ===
  var hvBtn = App.$("hideVisitedBtn");
  var nearbyChip = document.querySelector('.presets .chip[data-preset="nearby"]');

  // 周辺50km
  var fNearby = document.createElement("button");
  fNearby.className = "m-fchip";
  fNearby.textContent = "📍 周辺50km";
  fNearby.setAttribute("aria-pressed", nearbyChip.getAttribute("aria-pressed"));
  fNearby.addEventListener("click", function() {
    nearbyChip.click();
    syncFilterChips();
    syncSortMenu();
  });
  filterBar.appendChild(fNearby);

  // 未走行
  var fUnvisited = document.createElement("button");
  fUnvisited.className = "m-fchip";
  fUnvisited.textContent = "未走行";
  fUnvisited.setAttribute("aria-pressed", App.hideVisited ? "true" : "false");
  fUnvisited.addEventListener("click", function() {
    App.hideVisited = !App.hideVisited;
    if(App.hideVisited) App.showOnlyVisited = false;
    fUnvisited.setAttribute("aria-pressed", App.hideVisited ? "true" : "false");
    fVisited.setAttribute("aria-pressed", "false");
    hvBtn.setAttribute("aria-pressed", App.hideVisited ? "true" : "false");
    App.renderAndFit();
  });
  filterBar.appendChild(fUnvisited);

  // 走行済
  var fVisited = document.createElement("button");
  fVisited.className = "m-fchip";
  fVisited.textContent = "走行済";
  fVisited.setAttribute("aria-pressed", "false");
  fVisited.addEventListener("click", function() {
    App.showOnlyVisited = !App.showOnlyVisited;
    if(App.showOnlyVisited) App.hideVisited = false;
    fVisited.setAttribute("aria-pressed", App.showOnlyVisited ? "true" : "false");
    fUnvisited.setAttribute("aria-pressed", "false");
    hvBtn.setAttribute("aria-pressed", "false");
    App.renderAndFit();
  });
  filterBar.appendChild(fVisited);

  var fFavorite = document.createElement("button");
  fFavorite.className = "m-fchip";
  fFavorite.textContent = "お気に入り";
  fFavorite.setAttribute("aria-pressed", App.showOnlyFavorites ? "true" : "false");
  fFavorite.addEventListener("click", function() {
    App.showOnlyFavorites = !App.showOnlyFavorites;
    fFavorite.setAttribute("aria-pressed", App.showOnlyFavorites ? "true" : "false");
    App.$("showFavoritesBtn").setAttribute("aria-pressed", App.showOnlyFavorites ? "true" : "false");
    App.renderAndFit();
  });
  filterBar.appendChild(fFavorite);

  function syncFilterChips(){
    fNearby.setAttribute("aria-pressed", nearbyChip.getAttribute("aria-pressed"));
    fUnvisited.setAttribute("aria-pressed", App.hideVisited ? "true" : "false");
    fVisited.setAttribute("aria-pressed", App.showOnlyVisited ? "true" : "false");
    fFavorite.setAttribute("aria-pressed", App.showOnlyFavorites ? "true" : "false");
  }

  // === ボトムシート内ソートドロップダウン ===
  var sortMenu = App.$("mSortMenu");
  var sortCurrentEl = App.$("mSortCurrent");
  var SORT_PRESETS = [
    {key:"balance", label:"バランス"},
    {key:"corner", label:"コーナー重視"},
    {key:"updown", label:"標高重視"},
    {key:"seclusion", label:"秘境度重視"},
    {key:"uphill", label:"起伏重視"}
  ];
  SORT_PRESETS.forEach(function(item) {
    var btn = document.createElement("button");
    btn.textContent = item.label;
    btn.dataset.preset = item.key;
    if(App.currentPreset === item.key) btn.classList.add("active");
    btn.addEventListener("click", function() {
      var orig = document.querySelector('.presets .chip[data-preset="' + item.key + '"]');
      if(orig) orig.click();
      syncSortMenu();
      syncFilterChips();
      sortMenu.classList.remove("show");
    });
    sortMenu.appendChild(btn);
  });

  App.$("mSortBtn").addEventListener("click", function() {
    sortMenu.classList.toggle("show");
  });
  document.addEventListener("click", function(e) {
    if(!e.target.closest("#mSortBtn") && !e.target.closest("#mSortMenu")){
      sortMenu.classList.remove("show");
    }
  });

  function syncSortMenu(){
    var active = SORT_PRESETS.find(function(p){ return p.key === App.currentPreset; });
    sortCurrentEl.textContent = active ? active.label : "バランス";
    sortMenu.querySelectorAll("button").forEach(function(btn) {
      btn.classList.toggle("active", btn.dataset.preset === App.currentPreset);
    });
  }

  // === モバイルレイヤーポップアップ ===
  var mTerrain = App.$("mTerrainBtn");
  var layerPopup = App.$("mLayerPopup");
  var origTerrain = App.$("terrainToggle");

  mTerrain.addEventListener("click", function(e) {
    e.stopPropagation();
    layerPopup.classList.toggle("show");
  });
  document.addEventListener("click", function(e) {
    if(!e.target.closest("#mLayerPopup") && !e.target.closest("#mTerrainBtn")){
      layerPopup.classList.remove("show");
    }
  });

  function setLayer3d(on){
    var current = origTerrain.getAttribute("aria-pressed") === "true";
    if(current !== on) origTerrain.click();
    App.$("mLayer2d").classList.toggle("active", !on);
    App.$("mLayer3d").classList.toggle("active", on);
    layerPopup.classList.remove("show");
  }
  App.$("mLayer2d").addEventListener("click", function(){ setLayer3d(false); });
  App.$("mLayer3d").addEventListener("click", function(){ setLayer3d(true); });
  App.$("mLayerLogistics").addEventListener("click", function() {
    App.$("logisticsToggle").click();
    App.$("mLayerLogistics").classList.toggle("active", App.logisticsVisible);
  });
  App.$("mLayerClosure").addEventListener("click", function() {
    App.toggleClosure(!App.closureVisible);
    App.$("mLayerClosure").classList.toggle("active", App.closureVisible);
  });
  App.$("mLayerTourist").addEventListener("click", function() {
    App.toggleTourist(!App.touristVisible);
    App.$("mLayerTourist").classList.toggle("active", App.touristVisible);
  });
  App.$("mLayerToll").addEventListener("click", function() {
    App.toggleToll(!App.tollVisible);
    App.$("mLayerToll").classList.toggle("active", App.tollVisible);
  });
  App.$("mLayerRouteNum").addEventListener("click", function() {
    App.toggleRouteNum(!App.routeNumVisible);
    App.$("mLayerRouteNum").classList.toggle("active", App.routeNumVisible);
  });

  function syncMobilePrefState(){
    prefGrid.querySelectorAll(".m-pref-chip").forEach(function(btn) {
      btn.classList.toggle("selected", App.loadedPrefs.has(btn.dataset.code));
    });
    updateMobilePillText();
  }

  function updateMobilePillText(){
    var prefEl = App.$("mSpPref");
    var sepEl = App.$("mSpSep");
    var textEl = App.$("mSpText");
    textEl.textContent = "峠を検索";

    var names = [].concat(Array.from(App.loadedPrefs)).sort().map(function(c){ return App.PREFECTURES[c]; }).filter(Boolean);
    if(names.length === 0){
      prefEl.textContent = "";
      sepEl.style.display = "none";
    }else{
      sepEl.style.display = "";
      if(names.length <= 2){
        prefEl.textContent = names.join("・");
      }else{
        prefEl.textContent = names[0] + " +" + (names.length - 1);
      }
    }
  }

  var backdrop = App.$("mSearchBackdrop");

  // 検索ピルをタップ → オーバーレイ表示
  pill.addEventListener("click", function() {
    syncMobilePrefState();
    syncFilterChips();
    soInput.value = App.searchQuery || "";
    overlay.classList.add("show");
    backdrop.classList.add("show");
    renderSearchResults(soInput.value);
    setTimeout(function(){ soInput.focus(); }, 100);
  });

  // 閉じる
  App.closeMobileSearch = function(){
    overlay.classList.remove("show");
    backdrop.classList.remove("show");
    soInput.blur();
  };
  App.$("mSoCancel").addEventListener("click", App.closeMobileSearch);
  backdrop.addEventListener("click", App.closeMobileSearch);

  // 周辺ボタン
  App.$("mSoNearby").addEventListener("click", function() {
    App.closeMobileSearch();
    App.loadNearbyPrefs();
  });

  // 検索入力
  soInput.addEventListener("input", function(e) {
    renderSearchResults(e.target.value);
  });

  function renderSearchResults(q){
    q = (q || "").trim().toLowerCase();
    if(!q){
      soResults.innerHTML = "";
      App.$("mSoPrefSection").style.display = "";
      return;
    }
    var ranked = App.lastRanked.length ? App.lastRanked : App.currentItems;
    var hits = ranked.filter(function(t){
      return t.name.toLowerCase().includes(q) || t.routeLabel.toLowerCase().includes(q);
    }).slice(0, 20);

    if(hits.length){
      soResults.innerHTML = '<div class="m-so-section">検索結果</div>' +
        hits.map(function(t) {
          var name = App.escapeHtml(t.name).replace(
            new RegExp('(' + App.escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi'),
            '<span class="hit-match">$1</span>'
          );
          var pref = t._pref ? App.PREFECTURES[t._pref] : "";
          return '<div class="mock-hit" data-id="' + t.id + '">' +
            '<div class="hit-name">' + name + '</div>' +
            '<div class="hit-meta">' + (pref ? pref + " / " : "") + t.routeLabel + '</div>' +
          '</div>';
        }).join("");
      soResults.querySelectorAll(".mock-hit").forEach(function(el) {
        el.addEventListener("click", function() {
          var id = Number(el.dataset.id);
          var t = ranked.find(function(x){ return x.id === id; }) || App.currentItems.find(function(x){ return x.id === id; });
          if(t){
            App.closeMobileSearch();
            App.searchQuery = "";
            App.$("searchInput").value = "";
            App.revealAndSelect(t);
          }
        });
      });
      App.$("mSoPrefSection").style.display = "none";
    }else{
      soResults.innerHTML = '<div class="m-so-section">検索結果</div>' +
        '<p style="font-size:13px;color:var(--ink-soft);padding:8px 0">「' + App.escapeHtml(q) + '」に一致する峠はありません</p>';
      App.$("mSoPrefSection").style.display = "";
    }
  }

  // パネル内のプリセットチップ変更を監視してモバイル側も同期
  var obsPresets = new MutationObserver(function() {
    syncFilterChips();
    syncSortMenu();
    updateMobilePillText();
  });
  document.querySelectorAll(".presets .chip").forEach(function(chip) {
    obsPresets.observe(chip, {attributes:true, attributeFilter:["aria-pressed"]});
  });
  obsPresets.observe(hvBtn, {attributes:true, attributeFilter:["aria-pressed"]});

  // 都道府県変更イベントでピル側も更新
  document.addEventListener("pref-changed", function() {
    updateMobilePillText();
    syncMobilePrefState();
  });

  // 初期状態を反映
  updateMobilePillText();
  syncMobilePrefState();
  syncFilterChips();
  syncSortMenu();
};
