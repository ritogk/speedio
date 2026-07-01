// 峠サーチャー3D Service Worker
// - 同一オリジン(アプリ本体・峠JSON): network-first (常に最新、オフライン時はキャッシュ)
// - CDNライブラリ・フォント: cache-first (バージョン固定URLのため安全)
// - 地図タイル(地理院): cache-first + 上限付きLRU (圏外の山道でも表示継続)
const VERSION = "v1";
const RUNTIME_CACHE = `touge-runtime-${VERSION}`;
const TILE_CACHE = `touge-tiles-${VERSION}`;
const KNOWN_CACHES = [RUNTIME_CACHE, TILE_CACHE];

const TILE_HOST = "cyberjapandata.gsi.go.jp";
const CDN_HOSTS = [
  "cdnjs.cloudflare.com",
  "cdn.jsdelivr.net",
  "unpkg.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "demotiles.maplibre.org",
];
const TILE_MAX_ENTRIES = 2000;      // 1タイル20-60KB → 最大 約40-120MB
const CACHE_MAX_BYTES = 30 * 1024 * 1024; // これより大きいレスポンスはキャッシュしない

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith("touge-") && !KNOWN_CACHES.includes(k))
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

const tooBig = (res) => {
  const len = res.headers.get("content-length");
  return len && Number(len) > CACHE_MAX_BYTES;
};

const cacheFirst = (req, cacheName) =>
  caches.open(cacheName).then((cache) =>
    cache.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok || res.type === "opaque") cache.put(req, res.clone());
        return res;
      });
    })
  );

let tilePuts = 0;
const trimTiles = (cache) =>
  cache.keys().then((keys) => {
    if (keys.length <= TILE_MAX_ENTRIES) return;
    return Promise.all(keys.slice(0, keys.length - TILE_MAX_ENTRIES).map((k) => cache.delete(k)));
  });

const tileStrategy = (req) =>
  caches.open(TILE_CACHE).then((cache) =>
    cache.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok || res.type === "opaque") {
          cache.put(req, res.clone());
          if (++tilePuts % 50 === 0) trimTiles(cache);
        }
        return res;
      });
    })
  );

const networkFirst = (req) =>
  fetch(req)
    .then((res) => {
      if (res.ok && !tooBig(res)) {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    })
    .catch(() =>
      caches.match(req, { ignoreSearch: req.mode === "navigate" }).then((hit) => {
        if (hit) return hit;
        throw new Error("offline: no cache for " + req.url);
      })
    );

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.protocol !== "https:" && url.protocol !== "http:") return;

  if (url.host === TILE_HOST) {
    e.respondWith(tileStrategy(req));
  } else if (CDN_HOSTS.includes(url.host)) {
    e.respondWith(cacheFirst(req, RUNTIME_CACHE));
  } else if (url.origin === self.location.origin) {
    e.respondWith(networkFirst(req));
  }
  // その他 (Gemini API・逆ジオコーダ等) はSWを介さず素通し
});
