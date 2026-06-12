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
    const cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 256;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "rgb(1,134,160)";
    ctx.fillRect(0, 0, 256, 256);
    const blob = await new Promise<Blob | null>((r) =>
      cv.toBlob(r, "image/png"),
    );
    flatTileCache = await blob!.arrayBuffer();
    return flatTileCache;
  };

  return {
    register: () => {
      maplibregl.addProtocol("gsidem", async (params, abortController) => {
        try {
          const url = params.url.replace("gsidem://", "");
          const res = await fetch(url, { signal: abortController.signal });
          if (!res.ok) return { data: await flatTile() };
          const blob = await res.blob();
          const bmp = await createImageBitmap(blob);
          const cv = document.createElement("canvas");
          cv.width = bmp.width;
          cv.height = bmp.height;
          const ctx = cv.getContext("2d")!;
          ctx.drawImage(bmp, 0, 0);
          const img = ctx.getImageData(0, 0, cv.width, cv.height);
          dem.convertGsiDemToTerrainRgb(img.data);
          ctx.putImageData(img, 0, 0);
          const outBlob = await new Promise<Blob | null>((r) =>
            cv.toBlob(r, "image/png"),
          );
          return { data: await outBlob!.arrayBuffer() };
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
