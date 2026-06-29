// voice.js — 音声エージェント（Gemini 2.5 Flash + getUserMedia）
// Provides: App.initVoice()
"use strict";

(function(){

var GEMINI_MODEL = "gemini-2.5-flash";
var GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent";
var API_KEY_STORAGE = "touge.geminiApiKey";
var SAMPLE_RATE = 16000;

var conversationHistory = [];
var isRecording = false;
var isProcessing = false;
var selectedPassId = null;

var SYSTEM_INSTRUCTION = [
  "あなたは「峠サーチャー」の音声アシスタントです。",
  "ユーザーの音声指示に従って地図アプリを操作します。",
  "音声が送られてきたら、その内容を理解してfunction callで適切な操作を実行してください。",
  "応答は簡潔に、1〜2文で。峠の情報を伝えるときは名前・距離・特徴を含めてください。",
  "ユーザーが峠を選んだ文脈を覚えて、「3Dで見せて」「行く」等の後続指示に対応してください。"
].join("\n");

var TOOLS = [{
  function_declarations: [
    {
      name: "locate",
      description: "現在地を取得して地図上にピンを表示する"
    },
    {
      name: "toggle_logistics",
      description: "物流道路レイヤーの表示/非表示を切り替える",
      parameters: {
        type: "object",
        properties: {
          on: { type: "boolean", description: "trueで表示、falseで非表示。省略時はトグル" }
        }
      }
    },
    {
      name: "toggle_closure",
      description: "通行止めレイヤーの表示/非表示を切り替える",
      parameters: {
        type: "object",
        properties: {
          on: { type: "boolean", description: "trueで表示、falseで非表示。省略時はトグル" }
        }
      }
    },
    {
      name: "toggle_tourist",
      description: "観光名所レイヤーの表示/非表示を切り替える",
      parameters: {
        type: "object",
        properties: {
          on: { type: "boolean", description: "trueで表示、falseで非表示。省略時はトグル" }
        }
      }
    },
    {
      name: "toggle_toll",
      description: "有料道路レイヤーの表示/非表示を切り替える",
      parameters: {
        type: "object",
        properties: {
          on: { type: "boolean", description: "trueで表示、falseで非表示。省略時はトグル" }
        }
      }
    },
    {
      name: "toggle_nearby",
      description: "周辺50kmフィルターのON/OFFを切り替える。近くの峠を探す時に使う",
      parameters: {
        type: "object",
        properties: {
          on: { type: "boolean", description: "trueでON、falseでOFF。省略時はトグル" }
        }
      }
    },
    {
      name: "get_top_passes",
      description: "現在のランキングから上位の峠を取得する。近くのおすすめを聞かれた時などに使う",
      parameters: {
        type: "object",
        properties: {
          count: { type: "integer", description: "取得件数（デフォルト3）" }
        }
      }
    },
    {
      name: "select_pass",
      description: "指定した峠を選択状態にし、地図上でハイライトする",
      parameters: {
        type: "object",
        properties: {
          index: { type: "integer", description: "ランキング上の順位（0始まり）。get_top_passesで返した順位を使う" }
        },
        required: ["index"]
      }
    },
    {
      name: "show_3d",
      description: "現在選択中の峠を3Dビューで表示する"
    },
    {
      name: "set_camera",
      description: "3Dビューのカメラアングルを変更する",
      parameters: {
        type: "object",
        properties: {
          view: { type: "string", enum: ["top", "side", "reset"], description: "top=真上, side=側面, reset=初期位置" }
        },
        required: ["view"]
      }
    },
    {
      name: "close_3d",
      description: "3Dビューを閉じて地図に戻る"
    },
    {
      name: "start_navigation",
      description: "現在選択中の峠へのナビゲーション（Google Maps等）を起動する"
    }
  ]
}];

// --- APIキー管理 ---
function getApiKey(){
  return localStorage.getItem(API_KEY_STORAGE);
}

// --- WAVエンコード ---
function float32ToWavBase64(samples, sampleRate){
  var buffer = new ArrayBuffer(44 + samples.length * 2);
  var view = new DataView(buffer);
  function writeStr(o, s){ for(var i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); }
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for(var i = 0; i < samples.length; i++){
    var s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  var bytes = new Uint8Array(buffer);
  var binary = "";
  for(var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// --- Gemini API ---
function processAudio(wavBase64){
  var apiKey = getApiKey();
  if(!apiKey){
    App.toast("管理者パネルでGemini APIキーを設定してください", "error");
    updateUI("idle");
    return;
  }

  isProcessing = true;
  updateUI("thinking");
  var audioDurationSec = (wavBase64.length * 3 / 4 / 2 / SAMPLE_RATE).toFixed(1);
  console.log("[Voice] Gemini API送信, 履歴数:", conversationHistory.length, ", 音声:", audioDurationSec + "秒");

  var userContent = {
    role: "user",
    parts: [{ inline_data: { mime_type: "audio/wav", data: wavBase64 } }]
  };
  conversationHistory.push(userContent);

  callGemini(apiKey, function(err, result){
    if(err){
      console.error("[Voice] Gemini APIエラー:", err);
      isProcessing = false;
      updateUI("idle");
      if(err.status === 401 || err.status === 403){
        localStorage.removeItem(API_KEY_STORAGE);
        App.toast("APIキーが無効です。再入力してください", "error");
      } else {
        App.toast("AI応答エラー: " + (err.message || "不明"), "error");
      }
      return;
    }
    handleGeminiResponse(apiKey, result);
  });
}

function callGemini(apiKey, callback){
  var body = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: conversationHistory,
    tools: TOOLS,
    tool_config: { function_calling_config: { mode: "AUTO" } }
  };
  fetch(GEMINI_ENDPOINT + "?key=" + apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
  .then(function(r){
    if(!r.ok) return r.json().then(function(e){ throw { status: r.status, message: (e.error && e.error.message) || r.statusText }; });
    return r.json();
  })
  .then(function(data){
    console.log("[Voice] Gemini生レスポンス:", JSON.stringify(data, null, 2));
    if(!data.candidates || !data.candidates[0]) throw { message: "応答が空です" };
    callback(null, data.candidates[0].content);
  })
  .catch(function(e){ callback(e); });
}

function handleGeminiResponse(apiKey, content){
  conversationHistory.push({ role: "model", parts: content.parts });
  var functionCalls = content.parts.filter(function(p){ return p.functionCall; });

  if(functionCalls.length > 0){
    console.log("[Voice] function_call:", functionCalls.map(function(p){ return p.functionCall.name; }).join(", "));
    var results = [];
    var remaining = functionCalls.length;
    functionCalls.forEach(function(part){
      var fc = part.functionCall;
      executeCommand(fc.name, fc.args || {}, function(result){
        console.log("[Voice] コマンド実行:", fc.name, result);
        results.push({ functionResponse: { name: fc.name, response: result } });
        remaining--;
        if(remaining === 0){
          conversationHistory.push({ role: "user", parts: results });
          console.log("[Voice] function結果をGeminiに返送");
          callGemini(apiKey, function(err, nextContent){
            if(err){
              console.error("[Voice] Gemini 2回目エラー:", err);
              isProcessing = false;
              updateUI("idle");
              App.toast("AI応答エラー", "error");
              return;
            }
            handleGeminiResponse(apiKey, nextContent);
          });
        }
      });
    });
  } else {
    var textPart = content.parts.find(function(p){ return p.text; });
    var responseText = textPart ? textPart.text : "";
    console.log("[Voice] テキスト応答:", responseText);
    isProcessing = false;
    updateUI("idle");
    if(responseText){
      showResponse(responseText);
      speak(responseText);
    }
  }
}

// --- コマンド実行 ---
function executeCommand(name, args, callback){
  var result = { success: true };
  switch(name){
    case "locate":
      App.$("locateBtn").click();
      result.message = "現在地を取得しています";
      break;
    case "toggle_logistics":
      if(args.on !== undefined) App.toggleLogistics(args.on);
      else App.toggleLogistics(!App.logisticsVisible);
      result.message = "物流道路: " + (App.logisticsVisible ? "表示" : "非表示");
      break;
    case "toggle_closure":
      if(args.on !== undefined) App.toggleClosure(args.on);
      else App.toggleClosure(!App.closureVisible);
      result.message = "通行止め: " + (App.closureVisible ? "表示" : "非表示");
      break;
    case "toggle_tourist":
      if(args.on !== undefined) App.toggleTourist(args.on);
      else App.toggleTourist(!App.touristVisible);
      result.message = "観光名所: " + (App.touristVisible ? "表示" : "非表示");
      break;
    case "toggle_toll":
      if(args.on !== undefined) App.toggleToll(args.on);
      else App.toggleToll(!App.tollVisible);
      result.message = "有料道路: " + (App.tollVisible ? "表示" : "非表示");
      break;
    case "toggle_nearby":
      var nearbyChip = document.querySelector('.presets .chip[data-preset="nearby"]');
      if(args.on !== undefined){
        if((App.currentPreset === "nearby") !== args.on) nearbyChip.click();
      } else {
        nearbyChip.click();
      }
      result.message = "周辺50kmフィルター: " + (App.currentPreset === "nearby" ? "ON" : "OFF");
      break;
    case "get_top_passes":
      var count = args.count || 3;
      var ranked = App.lastRanked.slice(0, count);
      result.passes = ranked.map(function(t, i){
        return {
          index: i, name: t.name, route: t.routeLabel || "",
          distance_km: t.distanceKm ? Math.round(t.distanceKm * 10) / 10 : null,
          length_km: t.lengthKm, elevation_max: t.elevMax, width: t.width,
          score: t.balanceScore ? Math.round(t.balanceScore * 100) / 100 : null,
          visited: t.stableKey ? App.visitedKeys.has(t.stableKey) : false
        };
      });
      result.total = App.lastRanked.length;
      result.message = count + "件の峠を取得しました";
      break;
    case "select_pass":
      var idx = args.index || 0;
      if(idx < App.lastRanked.length){
        var t = App.lastRanked[idx];
        selectedPassId = t.id;
        App.revealAndSelect(t);
        result.message = t.name + "を選択しました";
        result.name = t.name;
      } else {
        result.success = false;
        result.message = "指定された順位の峠がありません";
      }
      break;
    case "show_3d":
      var target = findSelectedPass();
      if(target){
        App.open3DView(target);
        result.message = target.name + "を3D表示しました";
      } else {
        result.success = false;
        result.message = "峠が選択されていません。先に峠を選択してください";
      }
      break;
    case "set_camera":
      if(!App.has3DActive()){
        result.success = false;
        result.message = "3Dビューが開いていません";
        break;
      }
      var view = args.view || "top";
      if(view === "top") App.$("cam3dTop").click();
      else if(view === "side") App.$("cam3dSide").click();
      else App.$("cam3dReset").click();
      result.message = "カメラを" + ({top:"真上",side:"側面",reset:"初期位置"}[view]) + "に切り替えました";
      break;
    case "close_3d":
      App.close3DView();
      result.message = "3Dビューを閉じました";
      break;
    case "start_navigation":
      var navTarget = findSelectedPass();
      if(navTarget){
        App.openNav(navTarget);
        result.message = navTarget.name + "へのナビを起動しました";
      } else {
        result.success = false;
        result.message = "峠が選択されていません";
      }
      break;
    default:
      result.success = false;
      result.message = "不明なコマンド: " + name;
  }
  setTimeout(function(){ callback(result); }, 100);
}

function findSelectedPass(){
  if(selectedPassId != null){
    var t = App.lastRanked.find(function(x){ return x.id === selectedPassId; });
    if(t) return t;
  }
  return null;
}

// --- 音声合成 (TTS) ---
function speak(text){
  if(!window.speechSynthesis) return;
  speechSynthesis.cancel();
  var utt = new SpeechSynthesisUtterance(text);
  utt.lang = "ja-JP";
  utt.rate = 1.1;
  var voices = speechSynthesis.getVoices();
  var jaVoice = voices.find(function(v){ return v.lang.startsWith("ja"); });
  if(jaVoice) utt.voice = jaVoice;
  speechSynthesis.speak(utt);
}

// --- レスポンス表示 ---
function showResponse(text){
  var el = App.$("voiceResponse");
  if(!el) return;
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(el._timer);
  el._timer = setTimeout(function(){ el.classList.remove("show"); }, 6000);
}

// --- UI更新 ---
function updateUI(state){
  var btn = App.$("voiceBtn");
  var mBtn = App.$("mVoiceBtn");
  if(!btn) return;
  btn.classList.remove("recording", "thinking");
  if(mBtn) mBtn.classList.remove("recording", "thinking");
  if(state === "recording"){
    btn.classList.add("recording");
    if(mBtn) mBtn.classList.add("recording");
    App.toast("聞いています…");
  } else if(state === "thinking"){
    btn.classList.add("thinking");
    if(mBtn) mBtn.classList.add("thinking");
    App.toast("考えています…");
  }
}

// --- タップ録音（タップで開始、無音で自動停止）---
var tapChunks = [];
var tapStream = null;
var tapAudioCtx = null;

function toggleTapRecord(){
  if(isProcessing) return;
  if(isRecording){ finishTapRecord(); return; }
  isRecording = true;
  tapChunks = [];
  updateUI("recording");
  console.log("[Voice] 録音開始");

  navigator.mediaDevices.getUserMedia({ audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true } })
  .then(function(stream){
    if(!isRecording){ stream.getTracks().forEach(function(t){ t.stop(); }); return; }
    tapStream = stream;
    tapAudioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
    var source = tapAudioCtx.createMediaStreamSource(stream);
    var processor = tapAudioCtx.createScriptProcessor(4096, 1, 1);
    var hasVoice = false;
    var silenceStart = null;
    var SILENCE_THRESHOLD = 0.015;
    var SILENCE_DURATION = 2000;
    var MAX_CHUNKS = Math.ceil(SAMPLE_RATE * 30 / 4096);

    processor.onaudioprocess = function(e){
      if(!isRecording) return;
      var data = e.inputBuffer.getChannelData(0);
      tapChunks.push(new Float32Array(data));
      if(tapChunks.length >= MAX_CHUNKS){
        console.log("[Voice] 最大録音時間(30秒)到達 → 自動停止");
        finishTapRecord();
        return;
      }
      var rms = 0;
      for(var i = 0; i < data.length; i++) rms += data[i] * data[i];
      rms = Math.sqrt(rms / data.length);
      if(rms > SILENCE_THRESHOLD){
        hasVoice = true;
        silenceStart = null;
      } else if(hasVoice){
        if(!silenceStart) silenceStart = Date.now();
        else if(Date.now() - silenceStart > SILENCE_DURATION){
          console.log("[Voice] 無音検出 → 自動停止");
          finishTapRecord();
        }
      }
    };
    source.connect(processor);
    processor.connect(tapAudioCtx.destination);
    console.log("[Voice] マイク取得成功, 録音中…");
  })
  .catch(function(err){
    console.error("[Voice] マイクエラー:", err);
    isRecording = false;
    updateUI("idle");
    App.toast("マイクを使用できません");
  });
}

function finishTapRecord(){
  if(!isRecording) return;
  isRecording = false;
  if(tapStream){ tapStream.getTracks().forEach(function(t){ t.stop(); }); tapStream = null; }
  if(tapAudioCtx){ tapAudioCtx.close().catch(function(){}); tapAudioCtx = null; }

  console.log("[Voice] 録音停止, チャンク数:", tapChunks.length);
  if(tapChunks.length === 0){ updateUI("idle"); return; }

  var totalLen = 0;
  tapChunks.forEach(function(c){ totalLen += c.length; });
  var merged = new Float32Array(totalLen);
  var offset = 0;
  tapChunks.forEach(function(c){ merged.set(c, offset); offset += c.length; });
  tapChunks = [];

  var durationSec = (merged.length / SAMPLE_RATE).toFixed(1);
  console.log("[Voice] 音声データ: " + durationSec + "秒 → Gemini送信");
  var wavBase64 = float32ToWavBase64(merged, SAMPLE_RATE);
  processAudio(wavBase64);
}

// --- 初期化 ---
App.initVoice = function(){
  console.log("[Voice] initVoice 開始");

  var voiceBtn = App.$("voiceBtn");
  if(voiceBtn) voiceBtn.addEventListener("click", function(e){ e.preventDefault(); toggleTapRecord(); });

  var mVoiceBtn = App.$("mVoiceBtn");
  if(mVoiceBtn) mVoiceBtn.addEventListener("click", function(e){ e.preventDefault(); toggleTapRecord(); });

  // ヘルプ
  function showHelp(){ App.$("voiceHelpOverlay").classList.add("show"); }
  function hideHelp(){ App.$("voiceHelpOverlay").classList.remove("show"); }
  var pcHelp = App.$("pcVoiceHelp");
  if(pcHelp) pcHelp.addEventListener("click", showHelp);
  var mHelp = App.$("mVoiceHelp");
  if(mHelp) mHelp.addEventListener("click", showHelp);
  var helpClose = App.$("voiceHelpClose");
  if(helpClose) helpClose.addEventListener("click", hideHelp);
  var helpOverlay = App.$("voiceHelpOverlay");
  if(helpOverlay) helpOverlay.addEventListener("click", function(e){ if(e.target === helpOverlay) hideHelp(); });

  if(window.speechSynthesis){
    speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = function(){ speechSynthesis.getVoices(); };
  }
  console.log("[Voice] initVoice 完了, APIキー:", getApiKey() ? "設定済み" : "未設定");
};

})();
