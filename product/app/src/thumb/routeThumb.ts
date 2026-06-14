// 航空写真タイル+陰影+DEM標高から3Dコース図サムネイルをcanvas生成する。
// 地面はオブリーク投影（縦をK倍に圧縮して前傾）し、ルート線は標高分浮かせて立体感を出す。

import { dem } from "@/lib/dem";
import { tileMath } from "@/lib/tileMath";
import type { LatLng, TougeVM } from "@/types/touge";

interface RouteThumb {
  render(t: TougeVM, w: number, h: number): Promise<string | null>;
}

const loadTile = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // canvasをdataURL化するために必要
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const sampleElevations = async (
  pts: LatLng[],
  n: number,
): Promise<number[]> => {
  const SAMPLE_ZOOM = 12;
  const samples: { key: string; ox: number; oy: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[Math.round((i * (pts.length - 1)) / (n - 1))];
    const [x, y] = tileMath.lngLatToWorldPx(p[1], p[0], SAMPLE_ZOOM);
    samples.push({
      key: `${Math.floor(x / 256)}/${Math.floor(y / 256)}`,
      ox: Math.floor(x) % 256,
      oy: Math.floor(y) % 256,
    });
  }
  const tiles: Record<string, Uint8ClampedArray | null> = {};
  await Promise.all(
    [...new Set(samples.map((s) => s.key))].map(async (key) => {
      try {
        const img = await loadTile(
          `https://cyberjapandata.gsi.go.jp/xyz/dem_png/${SAMPLE_ZOOM}/${key}.png`,
        );
        const c = document.createElement("canvas");
        c.width = c.height = 256;
        const cx = c.getContext("2d")!;
        cx.drawImage(img, 0, 0);
        tiles[key] = cx.getImageData(0, 0, 256, 256).data;
      } catch {
        tiles[key] = null;
      }
    }),
  );
  return samples.map((s) => {
    const d = tiles[s.key];
    if (!d) return 0;
    const i = (s.oy * 256 + s.ox) * 4;
    return dem.gsiRgbToElevation(d[i], d[i + 1], d[i + 2]);
  });
};

export const routeThumb: RouteThumb = {
  render: async (t, W, H) => {
    const pts = t.poly;
    if (pts.length < 2) return null;
    const PAD = 12;
    let minLat = 90,
      maxLat = -90,
      minLng = 180,
      maxLng = -180;
    for (const p of pts) {
      minLat = Math.min(minLat, p[0]);
      maxLat = Math.max(maxLat, p[0]);
      minLng = Math.min(minLng, p[1]);
      maxLng = Math.max(maxLng, p[1]);
    }
    const PAD_TOP = 40,
      PAD_BTM = 14;
    const K = 0.62; // 地面の前傾率
    const [ax, ay] = tileMath.lngLatToWorldPx(minLng, maxLat, 0);
    const [bx, by] = tileMath.lngLatToWorldPx(maxLng, minLat, 0);
    const z = Math.min(
      16,
      Math.log2((W - 2 * PAD) / Math.max(bx - ax, 1e-9)),
      Math.log2((H - PAD_TOP - PAD_BTM) / K / Math.max(by - ay, 1e-9)),
    );
    const [x1, y1] = tileMath.lngLatToWorldPx(minLng, maxLat, z);
    const [x2, y2] = tileMath.lngLatToWorldPx(maxLng, minLat, z);
    const Hw = Math.ceil(H / K);
    const ky = H / Hw;
    const px0 = (x1 + x2) / 2 - W / 2;
    const py0 = (y1 + y2) / 2 - (Hw + (PAD_TOP - PAD_BTM) / ky) / 2;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext("2d")!;
    const ground = document.createElement("canvas");
    ground.width = W;
    ground.height = Hw;
    const gtx = ground.getContext("2d")!;
    gtx.fillStyle = "#171a17";
    gtx.fillRect(0, 0, W, Hw);
    const { zt, ts, tiles } = tileMath.enumerateTiles(z, px0, py0, W, Hw, 8, 13);
    const [photos, elevs] = await Promise.all([
      Promise.all(
        tiles.map(({ tx, ty }) =>
          loadTile(
            `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/${zt}/${tx}/${ty}.jpg`,
          )
            .then((img) => ({ img, tx, ty }))
            .catch(() => null),
        ),
      ),
      sampleElevations(pts, 48).catch(() => null),
    ]);
    for (const p of photos) {
      if (p) gtx.drawImage(p.img, p.tx * ts - px0, p.ty * ts - py0, ts, ts);
    }
    gtx.fillStyle = "rgba(8,10,8,.25)";
    gtx.fillRect(0, 0, W, Hw);
    ctx.drawImage(ground, 0, 0, W, Hw, 0, 0, W, H);
    const N = 48;
    const pxy: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      const p = pts[Math.round((i * (pts.length - 1)) / (N - 1))];
      const [x, y] = tileMath.lngLatToWorldPx(p[1], p[0], z);
      pxy.push([x - px0, (y - py0) * ky]);
    }
    let lift: number[] | null = null;
    let norm: number[] | null = null;
    if (elevs && elevs.some((e) => e !== 0)) {
      const mn = Math.min(...elevs);
      const span = Math.max(Math.max(...elevs) - mn, 1);
      const maxLift = Math.min(24, 6 + span / 20);
      norm = elevs.map((e) => (e - mn) / span);
      lift = norm.map((v) => 4 + v * maxLift);
    }
    ctx.lineJoin = ctx.lineCap = "round";
    const groundPath = () => {
      ctx.beginPath();
      pxy.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    };
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.6)";
    ctx.shadowBlur = 4;
    groundPath();
    ctx.strokeStyle = "rgba(0,0,0,.5)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    if (lift && norm) {
      ctx.lineWidth = 1.5;
      for (let i = 0; i < N; i++) {
        const v = norm[i];
        ctx.strokeStyle = `hsla(${218 - v * 165}, 95%, ${52 + v * 10}%, .6)`;
        ctx.beginPath();
        ctx.moveTo(pxy[i][0], pxy[i][1]);
        ctx.lineTo(pxy[i][0], pxy[i][1] - lift[i]);
        ctx.stroke();
      }
      const liftArr = lift;
      const path3 = () => {
        ctx.beginPath();
        pxy.forEach(([x, y], i) =>
          i ? ctx.lineTo(x, y - liftArr[i]) : ctx.moveTo(x, y - liftArr[i]),
        );
      };
      path3();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3.5;
      ctx.stroke();
      path3();
      ctx.strokeStyle = "#E10600";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      groundPath();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3.5;
      ctx.stroke();
      groundPath();
      ctx.strokeStyle = "#E10600";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    return cv.toDataURL("image/jpeg", 0.82);
  },
};
