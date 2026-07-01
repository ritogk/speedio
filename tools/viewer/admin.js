// admin.js — 管理者パネル（重み調整・座標コピー）
// Uses: App.$, App.map, App.BALANCE_WEIGHTS, App.toast, App.render
// Provides: App.initAdmin()

App.initAdmin = function() {
  const ADMIN_KEY = "speedio_admin";
  const wp = App.$("adminPanel");
  if(localStorage.getItem(ADMIN_KEY) === "1"){
    wp.classList.add("show");
    App.$("adminToggleBtn").style.display = "";
  }
  wp.querySelectorAll("input[data-w]").forEach(inp=>{
    inp.value = App.BALANCE_WEIGHTS[inp.dataset.w];
  });
  App.$("visitDelayInput").value = parseInt(localStorage.getItem(App.VISIT_DELAY_KEY),10) || 60;
  App.$("visitDelayInput").addEventListener("change", e=>{
    const v = Math.max(1, Math.min(3600, parseInt(e.target.value,10) || 60));
    e.target.value = v;
    localStorage.setItem(App.VISIT_DELAY_KEY, v);
  });
  // 訪問確認ダイアログを移動チェックなしで即表示する（デバッグ用）
  App.$("visitImmediateChk").checked = localStorage.getItem(App.VISIT_IMMEDIATE_KEY) === "1";
  App.$("visitImmediateChk").addEventListener("change", e=>{
    if(e.target.checked) localStorage.setItem(App.VISIT_IMMEDIATE_KEY, "1");
    else localStorage.removeItem(App.VISIT_IMMEDIATE_KEY);
  });
  // PCで記録UI(行った/お気に入り/走行中)を表示する（デバッグ用。基本OFF）
  App.$("pcRecordChk").checked = localStorage.getItem(App.PC_RECORD_KEY) === "1";
  App.$("pcRecordChk").addEventListener("change", e=>{
    if(e.target.checked) localStorage.setItem(App.PC_RECORD_KEY, "1");
    else localStorage.removeItem(App.PC_RECORD_KEY);
    document.body.classList.toggle("no-record-ui", !App.recordUiEnabled());
    App.render();
  });
  const toggleAdmin = ()=> wp.classList.toggle("collapsed");
  App.$("adminToggleBtn").addEventListener("click", toggleAdmin);
  App.$("wpClose").addEventListener("click", ()=> wp.classList.add("collapsed"));
  wp.addEventListener("keydown",e=>{ if(e.key==="Enter") App.$("weightApply").click(); });

  let adminPin = null;
  App.$("adminPinBtn").addEventListener("click",()=>{
    const val = App.$("adminLatLng").value.trim();
    const parts = val.split(/[,\s]+/).map(Number);
    if(parts.length < 2 || parts.some(isNaN)){ App.toast("緯度,経度 の形式で入力"); return; }
    const [lat, lng] = parts;
    if(adminPin) adminPin.remove();
    adminPin = new maplibregl.Marker({color:"#2563eb", occludedOpacity:1}).setLngLat([lng, lat]).addTo(App.map);
    App.map.flyTo({center:[lng, lat], zoom:14, duration:800});
  });

  const geminiKeyInput = App.$("adminGeminiKey");
  const savedKey = localStorage.getItem("touge.geminiApiKey");
  if(savedKey) geminiKeyInput.value = savedKey;
  App.$("adminGeminiSave").addEventListener("click", ()=>{
    const key = geminiKeyInput.value.trim();
    if(key){
      localStorage.setItem("touge.geminiApiKey", key);
      App.toast("APIキーを保存しました");
    } else {
      localStorage.removeItem("touge.geminiApiKey");
      App.toast("APIキーを削除しました");
    }
  });

  wp.querySelectorAll("input").forEach(inp=>{
    inp.addEventListener("focus", ()=>{
      setTimeout(()=> inp.scrollIntoView({behavior:"smooth", block:"center"}), 300);
    });
  });

  App.map.on("contextmenu", e=>{
    const {lat, lng} = e.lngLat;
    const text = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    navigator.clipboard.writeText(text).then(()=> App.toast(`コピー: ${text}`));
    e.preventDefault();
  });
  App.$("weightApply").addEventListener("click",()=>{
    wp.querySelectorAll("input[data-w]").forEach(inp=>{
      const v = parseFloat(inp.value);
      if(!isNaN(v)) App.BALANCE_WEIGHTS[inp.dataset.w] = v;
    });
    document.querySelectorAll(".presets .chip[data-preset]").forEach(c=>c.setAttribute("aria-pressed","false"));
    document.querySelector('.chip[data-preset="balance"]').setAttribute("aria-pressed","true");
    App.currentPreset = "balance";
    App.distanceFilter = null;
    App.$("presetHint").textContent = App.presetHints.balance;
    App.visibleCount = App.PAGE_N;
    App.renderAndFit();
    App.toast("重みを適用しました");
  });
};
