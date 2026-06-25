// terrain.js — 国土地理院DEM → terrain-rgb 変換プロトコル
// Uses: (なし — maplibregl.addProtocol のみ)
// Provides: App.initTerrain()
"use strict";

App.initTerrain = function(){
  var FLAT_TILE = (function(){
    var cache = null;
    return async function(){
      if(cache) return cache;
      var cv = new OffscreenCanvas(256, 256);
      var ctx = cv.getContext("2d");
      ctx.fillStyle = "rgb(1,134,160)";
      ctx.fillRect(0,0,256,256);
      var blob = await cv.convertToBlob({type:"image/png"});
      cache = await blob.arrayBuffer();
      return cache;
    };
  })();
  var demCache = new Map();
  var DEM_CACHE_MAX = 4096;
  var canvas = new OffscreenCanvas(256, 256);
  var ctx = canvas.getContext("2d", {willReadFrequently:true});

  maplibregl.addProtocol("gsidem", async function(params){
    try {
      var url = params.url.replace("gsidem://", "");
      var cached = demCache.get(url);
      if(cached) return {data: cached};
      var res = await fetch(url);
      if(!res.ok) return {data: await FLAT_TILE()};
      var blob = await res.blob();
      var bmp = await createImageBitmap(blob);
      canvas.width = bmp.width; canvas.height = bmp.height;
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var buf32 = new Uint32Array(img.data.buffer);
      for(var i = 0, len = buf32.length; i < len; i++){
        var px = buf32[i];
        var r = px & 0xFF, g = (px >> 8) & 0xFF, b = (px >> 16) & 0xFF;
        var x = r*65536 + g*256 + b;
        var h = x === 8388608 ? 0 : (x < 8388608 ? x*0.01 : (x-16777216)*0.01);
        var v = (h + 10000) * 10 + 0.5 | 0;
        buf32[i] = ((v / 65536 | 0) % 256) | (((v >> 8) & 0xFF) << 8) | ((v & 0xFF) << 16) | 0xFF000000;
      }
      ctx.putImageData(img, 0, 0);
      var outBlob = await canvas.convertToBlob({type:"image/png"});
      var buf = await outBlob.arrayBuffer();
      if(demCache.size >= DEM_CACHE_MAX) demCache.delete(demCache.keys().next().value);
      demCache.set(url, buf);
      return {data: buf};
    } catch(err) {
      console.warn("[gsidem] tile convert failed:", err.message);
      return {data: await FLAT_TILE()};
    }
  });
};
