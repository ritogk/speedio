import { describe, expect, it } from "vitest";

import { urls } from "@/lib/urls";
import type { LatLng } from "@/types/touge";

describe("googleMapUrl", () => {
  it("始点→中点→終点の経路URLを生成する", () => {
    const poly: LatLng[] = [
      [35.0, 137.0],
      [35.1, 137.1],
      [35.2, 137.2],
    ];
    expect(urls.googleMap(poly)).toBe(
      "https://www.google.co.jp/maps/dir/35,137/35.1,137.1/35.2,137.2",
    );
  });

  it("空ポリラインは # を返す", () => {
    expect(urls.googleMap([])).toBe("#");
  });
});

describe("streetViewUrl", () => {
  it("2点未満は null", () => {
    expect(urls.streetView([])).toBeNull();
    expect(urls.streetView([[35, 137]])).toBeNull();
  });

  it("真北への進行は heading=0", () => {
    const poly: LatLng[] = [
      [35.0, 137.0],
      [35.1, 137.0],
      [35.2, 137.0],
    ];
    const url = urls.streetView(poly)!;
    expect(url).toContain("viewpoint=35.1,137");
    expect(url).toContain("heading=0");
  });

  it("真東への進行は heading=90 付近", () => {
    const poly: LatLng[] = [
      [35.0, 137.0],
      [35.0, 137.1],
      [35.0, 137.2],
    ];
    const m = urls.streetView(poly)!.match(/heading=(\d+)/);
    expect(Number(m![1])).toBeGreaterThanOrEqual(89);
    expect(Number(m![1])).toBeLessThanOrEqual(91);
  });
});
