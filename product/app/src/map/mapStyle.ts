// GSIタイル（航空写真+DEM陰影+sky）のMapLibreスタイル定義と初期カメラ。

import type { StyleSpecification, TerrainSpecification } from "maplibre-gl";

interface MapStyle {
  terrain: TerrainSpecification;
  initialView: {
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
    maxPitch: number;
  };
  build(): StyleSpecification;
}

const GSI_ATTR =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>';

export const mapStyle: MapStyle = {
  terrain: { source: "gsiTerrain", exaggeration: 1.2 },

  initialView: {
    center: [137.5, 36.2],
    zoom: 5,
    pitch: 55,
    bearing: -10,
    maxPitch: 75,
  },

  build: () => ({
    version: 8,
    sources: {
      photo: {
        type: "raster",
        tiles: [
          "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
        ],
        tileSize: 256,
        maxzoom: 18,
        attribution: GSI_ATTR,
      },
      gsiTerrain: {
        type: "raster-dem",
        tiles: [
          "gsidem://https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        maxzoom: 14,
      },
    },
    layers: [
      {
        id: "photo",
        type: "raster",
        source: "photo",
        paint: {
          "raster-brightness-max": 0.9,
          "raster-saturation": -0.1,
          "raster-contrast": 0.03,
        },
      },
      {
        id: "greenTint",
        type: "background",
        paint: { "background-color": "#1E4D33", "background-opacity": 0.18 },
      },
      {
        id: "hillshade",
        type: "hillshade",
        source: "gsiTerrain",
        paint: {
          "hillshade-exaggeration": 0.25,
          "hillshade-shadow-color": "#101510",
          "hillshade-highlight-color": "#FFFFFF",
          "hillshade-accent-color": "#101510",
        },
      },
    ],
    sky: {
      "sky-color": "#86A8CF",
      "horizon-color": "#E9EDF1",
      "fog-color": "#DCE3E9",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.55,
    },
    terrain: mapStyle.terrain,
  }),
};
