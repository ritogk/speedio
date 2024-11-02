import target from "./target.json" with { type: "json" };
import * as L from "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/+esm";
import { generateHtml } from "./popup.js";
import { draw3D } from "./3d.js";
import { drawGraph } from "./graph.js"

let map;
export const init = async () => {
  // 地図を初期化し、指定位置を中心にする
  map = L.map("map").setView(
    [target[0].geometry_list[0][0], target[0].geometry_list[0][1]],
    13
  );
  // 国土地理院の航空写真
  // L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', {
  //   attribution: "<a href='https://maps.gsi.go.jp/development/ichiran.html' target='_blank'>国土地理院</a>",
  //   maxZoom: 18
  // }).addTo(map);

  // OpenStreetMapのタイルレイヤーを追加
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // attributionを削除(リリースするときは表示させる。)
  document
    .querySelector(
      "#map > div.leaflet-control-container > div.leaflet-bottom.leaflet-right"
    )
    .remove();

  map.on("contextmenu", function (e) {
    const coord = e.latlng;
    const text = coord.lat + "," + coord.lng;
    navigator.clipboard.writeText(text).then(function() {
      console.log('クリップボードにコピーされました: ', text);
    }).catch(function(err) {
        console.error('クリップボードへのコピーに失敗しました: ', err);
    });
  });

  // await setupPrefecturesLayer()
};

// 都道府県レイヤーの設定
const setupPrefecturesLayer = async () => {
  let selectedPolygon = null;
  const prefecturesMultiPolygonPath = './prefectures.geojson';
  const response = await fetch(prefecturesMultiPolygonPath);
  const data = await response.json();
  L.geoJSON(data, {
    style: { color: 'blue', weight: 1 },
    onEachFeature: (feature, layer) => {
        layer.on('mouseover', () => layer.setStyle({ color: 'red' }));
        layer.on('mouseout', () => layer.setStyle({ color: 'blue' }));
        layer.on('click', () => {
          // 以前に選択されていたポリゴンを元の色に戻す
          if (selectedPolygon) {
            selectedPolygon.setStyle({ fillOpacity: 0.2 });
          }
          // 新しいポリゴンを透明にし、選択されたポリゴンとして設定
          layer.setStyle({ fillOpacity: 0.0 });
          selectedPolygon = layer;
        });
    }
  }).addTo(map);
}

let polylines = [];
const clearPolylines = () => {
  for (let polyline of polylines) {
    polyline.remove(); // 地図からポリラインを削除
  }
  polylines = []; // 配列を空にする
};

let markers = [];
const clearMarkers = () => {
  for (let marker of markers) {
    marker.remove();
  }
  markers = []; // 配列を空にする
};

export const draw = () => {
  clearPolylines();
  clearMarkers();

  // スコア計算
  let targets = calcScore([...target]);

  // フィルタリング
  targets = filter([...targets]);

  targets.forEach((x) => {
    const polyline = x.geometry_list;
    const scoreNormalization = x.score_normalization;
    const style = generateStyle(scoreNormalization);
    const line = L.polyline(polyline, style)
      .bindPopup(generateHtml(x), { maxWidth: 1100, width:500 })
      .addTo(map);
    line.on("popupopen", (e) => {
      console.log(x)
      console.log(x.elevation_segment_list)
      drawGraph(x.elevation_segment_list);
      draw3D(x.geometry_meter_list, x.elevation_smooth, x.terrain_elevation_file_path);
    });
    polylines.push(line);
  });

  // 曲がり角にマーカーを表示
  targets.forEach((x) => {
    // 曲がり角
    const turn_points = x.turn_points;
    turn_points.forEach((turn_point) => {
      const lat = turn_point[1];
      const lng = turn_point[0];

      const iconSize = [20, 20];
      const value = "角";
      const myCustomIcon = L.divIcon({
        className: "my-custom-icon", // カスタムスタイルのクラス名
        html: `<div style="background-color: mediumvioletred; border-radius: 50%; color: white;text-align: center;">${value}</div>`, // 表示したい数値
        iconSize: iconSize, // アイコンのサイズ
        iconAnchor: [iconSize[0] / 2, iconSize[1] / 2], // アイコンのアンカーポイント
      });

      const marker = L.marker([lat, lng], {
        icon: myCustomIcon,
      }).addTo(map);
      polylines.push(marker);
    });
  });

  // 上位20件の中心座標にランクを表示
  const ranks = targets
    .sort((a, b) => b.score_normalization - a.score_normalization)
    .slice(0, 10);
  // console.log(JSON.stringify(top10[0].elevation));
  // console.log(JSON.stringify(top10[0].geometry_meter_list));
  // console.log(JSON.stringify(top10[0].score_normalization));
  ranks.forEach((x, index) => {
    const center = Math.ceil(x.geometry_list.length / 2);
    const marker = L.marker(x.geometry_list[center], {
      icon: generateLabelIcon(index + 1),
    }).addTo(map);
    polylines.push(marker);
  });
};

export const addPin = (lat, lng) => {
  if (lat >= 24 && lat <= 46 && lng >= 122 && lng <= 153) {
  } else {
    const temp = lat;
    lat = lng;
    lng = temp;
  }
  L.marker([lat, lng]).addTo(map);
  map.setView([lat, lng], 13);
};

const filter = (targets) => {
  const filterKey1 = document.getElementById("filterKey1").value;
  const filterValue = document.getElementById("filterValue").value;
  targets =
    filterValue === "" || filterKey1 === ""
      ? target
      : target.filter((x) => x[filterKey1] == filterValue);

  const filterKey2 = document.getElementById("filterKey2").value;
  const filterKey2minValue = document.getElementById("filterKey2minValue").value;
  const filterKey2maxValue = document.getElementById("filterKey2maxValue").value;
  targets =
    filterKey2 === "" || filterKey2minValue === ""
      ? targets
      : targets.filter((x) => x[filterKey2] >= Number(filterKey2minValue));
  targets =
    filterKey2 === "" || filterKey2maxValue === ""
      ? targets
      : targets.filter((x) => x[filterKey2] <= Number(filterKey2maxValue));
  const filterKey3 = document.getElementById("filterKey3").value;
  const filterKey3minValue = document.getElementById("filterKey3minValue").value;
  const filterKey3maxValue = document.getElementById("filterKey3maxValue").value;
  targets =
    filterKey3 === "" || filterKey3minValue === ""
      ? targets
      : targets.filter((x) => x[filterKey3] >= Number(filterKey3minValue));
  targets =
    filterKey3 === "" || filterKey3maxValue === ""
      ? targets
      : targets.filter((x) => x[filterKey3] <= Number(filterKey3maxValue));
  return targets;
};

const calcScore = (targets) => {
  // 重み
  const WEIGHTS = {
    elevation: Number(document.getElementById("weightElevation").value),
    elevation_unevenness: Number(
      document.getElementById("weightElevationUnevenness").value
    ),
    width: Number(document.getElementById("weightWidth").value),
    length: Number(document.getElementById("weightLength").value),
    building: Number(document.getElementById("weightBuilding").value),
    tunnel_outside: Number(document.getElementById("wightTunnelOutside").value),
    corner: {
      week: Number(
        document.getElementById("wightCornerWeek").value
      ),
      medium: Number(
        document.getElementById("wightCornerMedium").value
      ),
      strong: Number(
        document.getElementById("wightCornerStrong").value
      ),
      none: Number(document.getElementById("wightCornerNone").value),
    },
    corner_balance: Number(document.getElementById("wightCornerBalance").value),
  };

  // スコア計算
  targets = targets.map((x) => {
    x.score =
      (x.score_elevation * WEIGHTS.elevation +
        x.score_elevation_unevenness * WEIGHTS.elevation_unevenness +
        x.score_width * WEIGHTS.width +
        x.score_length * WEIGHTS.length +
        x.score_building * WEIGHTS.building +
        x.score_tunnel_outside * WEIGHTS.tunnel_outside + 
        (
          x.score_corner_week * WEIGHTS.corner.week +
          x.score_corner_medium * WEIGHTS.corner.medium +
          x.score_corner_strong * WEIGHTS.corner.strong +
          x.score_corner_none * WEIGHTS.corner.none
        ) + 
        x.score_corner_balance * WEIGHTS.corner_balance)/
      Object.keys(WEIGHTS).length;
    return x;
  });

  // 正規化
  const maxScore = Math.max(...targets.map((x) => x.score));
  const minScore = Math.min(...targets.map((x) => x.score));
  // 1件のみの場合は正規化しない
  if (maxScore === minScore) {
    return targets.map((x) => {
      x.score_normalization = 1;
      return x;
    });
  }
  return targets.map((x) => {
    x.score_normalization = (x.score - minScore) / (maxScore - minScore);
    return x;
  });
};

const generateStyle = (value) => {
  let r = 0,
    g = 0,
    b = 0;
  if (value < 0.5) {
    // 0.0から0.5の範囲では、青から緑へ
    g = 2 * value * 255;
    b = (1 - 2 * value) * 255;
  } else {
    // 0.5から1.0の範囲では、緑から赤へ
    r = 2 * (value - 0.5) * 255;
    g = (1.0 - value) * 2 * 255;
  }

  g = 0;
  b = Math.round(255 * (1 - value));
  r = Math.round(255 * value);

  const generateWeight = (value) => {
    if (value < 0.3) return 3;
    if (value < 0.5) return 5;
    if (value < 0.7) return 7;
    if (value < 0.9) return 10;
    if (value < 0.999) return 15;
    return 25;
  };

  const generateOpacity = (value) => {
    return 0.5;
  };

  return {
    color:
      "rgb(" + Math.round(r) + " ," + Math.round(g) + "," + Math.round(b) + ")",
    weight: generateWeight(value),
    opacity: generateOpacity(value),
  };
};

const generateLabelIcon = (value) => {
  const iconSize = [20, 20];
  const myCustomIcon = L.divIcon({
    className: "my-custom-icon", // カスタムスタイルのクラス名
    html: `<div style="background-color: darkslateblue; border-radius: 50%; color: white;text-align: center;">${value}</div>`, // 表示したい数値
    iconSize: iconSize, // アイコンのサイズ
    iconAnchor: [iconSize[0] / 2, iconSize[1] / 2], // アイコンのアンカーポイント
  });
  return myCustomIcon;
};
