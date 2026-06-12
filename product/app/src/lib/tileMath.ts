// Webメルカトルのタイル座標計算（純関数）。

export interface TileRange {
  zt: number;
  ts: number;
  tiles: { tx: number; ty: number }[];
}

interface TileMath {
  lngLatToWorldPx(lng: number, lat: number, z: number): [number, number];
  enumerateTiles(
    z: number,
    px0: number,
    py0: number,
    w: number,
    h: number,
    minZt?: number,
    maxZt?: number,
  ): TileRange;
}

export const tileMath: TileMath = {
  lngLatToWorldPx: (lng, lat, z) => {
    const scale = 256 * Math.pow(2, z);
    const s = Math.sin((lat * Math.PI) / 180);
    return [
      ((lng + 180) / 360) * scale,
      (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
    ];
  },

  enumerateTiles: (z, px0, py0, w, h, minZt = 8, maxZt = 16) => {
    const zt = Math.max(minZt, Math.min(maxZt, Math.ceil(z)));
    const ts = 256 * Math.pow(2, z - zt);
    const tiles: { tx: number; ty: number }[] = [];
    for (
      let tx = Math.floor(px0 / ts);
      tx <= Math.floor((px0 + w) / ts);
      tx++
    ) {
      for (
        let ty = Math.floor(py0 / ts);
        ty <= Math.floor((py0 + h) / ts);
        ty++
      ) {
        tiles.push({ tx, ty });
      }
    }
    return { zt, ts, tiles };
  },
};
