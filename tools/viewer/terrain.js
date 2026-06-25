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

  function createHandler(){
    var canvas = new OffscreenCanvas(256, 256);
    var ctx = canvas.getContext("2d", {willReadFrequently:true});
    return async function(params){
    try {
      var url = params.url.replace(/^gsidem2?:\/\//, "");
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
      var d = img.data;
      for(var i = 0; i < d.length; i += 4){
        var x = d[i]*65536 + d[i+1]*256 + d[i+2];
        var h = 0;
        if(x !== 8388608){
          h = x < 8388608 ? x*0.01 : (x-16777216)*0.01;
        }
        var v = Math.round((h + 10000) * 10);
        d[i]   = Math.floor(v / 65536) % 256;
        d[i+1] = Math.floor(v / 256) % 256;
        d[i+2] = v % 256;
        d[i+3] = 255;
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
  };
  }

  maplibregl.addProtocol("gsidem", createHandler());
  maplibregl.addProtocol("gsidem2", createHandler());
};
