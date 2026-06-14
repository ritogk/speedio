// GSIのdem_png(標高PNG)をMapbox terrain-rgbへ変換する gsidem:// プロトコル。
// Map生成より前に register() を1回呼ぶ。タイルが無い領域（海上など）は標高0の平坦タイルで代替。

import maplibregl from "maplibre-gl";

import { dem } from "@/lib/dem";

interface GsiDemProtocol {
  register(): void;
}

const createGsiDemProtocol = (): GsiDemProtocol => {
  let flatTileCache: ArrayBuffer | null = null;
  const flatTile = async (): Promise<ArrayBuffer> => {
    if (flatTileCache) return flatTileCache;
    const cv = new OffscreenCanvas(256, 256);
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "rgb(1,134,160)";
    ctx.fillRect(0, 0, 256, 256);
    const blob = await cv.convertToBlob({ type: "image/png" });
    flatTileCache = await blob.arrayBuffer();
    return flatTileCache;
  };

  const demCache = new Map<string, ArrayBuffer>();
  const DEM_CACHE_MAX = 4096;
  const demCanvas = new OffscreenCanvas(256, 256);
  const demCtx = demCanvas.getContext("2d", {
    willReadFrequently: true,
  })!;

  return {
    register: () => {
      maplibregl.addProtocol("gsidem", async (params, abortController) => {
        try {
          const url = params.url.replace("gsidem://", "");
          const cached = demCache.get(url);
          if (cached) return { data: cached };
          const res = await fetch(url, { signal: abortController.signal });
          if (!res.ok) return { data: await flatTile() };
          const blob = await res.blob();
          const bmp = await createImageBitmap(blob);
          demCanvas.width = bmp.width;
          demCanvas.height = bmp.height;
          demCtx.drawImage(bmp, 0, 0);
          bmp.close();
          const img = demCtx.getImageData(
            0,
            0,
            demCanvas.width,
            demCanvas.height,
          );
          dem.convertGsiDemToTerrainRgb(img.data);
          demCtx.putImageData(img, 0, 0);
          const outBlob = await demCanvas.convertToBlob({
            type: "image/png",
          });
          const buf = await outBlob.arrayBuffer();
          if (demCache.size >= DEM_CACHE_MAX)
            demCache.delete(demCache.keys().next().value!);
          demCache.set(url, buf);
          return { data: buf };
        } catch (err) {
          if ((err as Error).name === "AbortError") throw err;
          console.warn("[gsidem] tile convert failed:", (err as Error).message);
          return { data: await flatTile() };
        }
      });
    },
  };
};

export const gsiDemProtocol = createGsiDemProtocol();
