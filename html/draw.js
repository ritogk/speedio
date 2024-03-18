import target from "./target.json" assert { type: "json" };
import * as L from "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/+esm";

// 数値を小数点2桁で丸める
export const truncateToTwoDecimals = (value) => {
  return Math.floor(value * 1000) / 1000;
};

let map;
export const init = () => {
  // 地図を初期化し、指定位置を中心にする
  map = L.map("map").setView(
    [target[0].geometry_list[0][0], target[0].geometry_list[0][1]],
    13
  );
  // OpenStreetMapのタイルレイヤーを追加
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
};

let polylines = [];
const clearPolylines = () => {
  for (let polyline of polylines) {
    polyline.remove(); // 地図からポリラインを削除
  }
  polylines = []; // 配列を空にする
};

export const draw = () => {
  clearPolylines();

  // スコア計算
  let targets = calcScore([...target]);

  // フィルタリング
  targets = filter([...targets]);

  targets.forEach((x) => {
    const polyline = x.geometry_list;
    const scoreNormalization = x.score_normalization;
    const ed = polyline[polyline.length - 1];
    const center = polyline[Math.floor(polyline.length / 2)];
    const st = polyline[0];

    const style = generateStyle(scoreNormalization);

    const line = L.polyline(polyline, style)
      .bindPopup(
        `<span style="font-weight:bold;">Score</span>
        <table style="width:100%;" border="1">
          <tr>
              <td>score_normalization</td>
              <td>${truncateToTwoDecimals(scoreNormalization)}</td>
          </tr>
          <tr>
              <td>score</td>
              <td>${truncateToTwoDecimals(x.score)}</td>
          </tr>
          <tr>
              <td>score_angle</td>
              <td>${truncateToTwoDecimals(x.score_angle)}</td>
          </tr>
          <tr>
              <td>score_elevation</td>
              <td>${truncateToTwoDecimals(x.score_elevation)}</td>
          </tr>
          <tr>
              <td>score_elevation_over_heiht</td>
              <td>${truncateToTwoDecimals(x.score_elevation_over_heiht)}</td>
          </tr>
          <tr>
              <td>score_elevation_u_shape</td>
              <td>${truncateToTwoDecimals(x.score_elevation_u_shape)}</td>
          </tr>
          <tr>
              <td>score_width</td>
              <td>${truncateToTwoDecimals(x.score_width)}</td>
          </tr>
          <tr>
              <td>score_length</td>
              <td>${truncateToTwoDecimals(x.score_length)}</td>
          </tr>
        </table>


        <span style="font-weight:bold;">Created</span>
        <table style="width:100%;" border="1">
          <tr>
              <td>elevation_deltas</td>
              <td>${truncateToTwoDecimals(x.elevation_deltas)}</td>
          </tr>
          <tr>
              <td>elevation_height</td>
              <td>${truncateToTwoDecimals(x.elevation_height)}</td>
          </tr>
          <tr>
              <td>elevation_deltas_and_length_ratio</td>
              <td>${truncateToTwoDecimals(
                x.elevation_deltas_and_length_ratio
              )}</td>
          </tr>
          <tr>
              <td>elavation_height_and_length_ratio</td>
              <td>${truncateToTwoDecimals(
                x.elavation_height_and_length_ratio
              )}</td>
          </tr>
          <tr>
              <td>elevation_u_shape</td>
              <td>${truncateToTwoDecimals(x.elevation_u_shape)}</td>
          </tr>
          <tr>
              <td>angle_deltas</td>
              <td>${truncateToTwoDecimals(x.angle_deltas)}</td>
          </tr>
          <tr>
              <td>angle_and_length_ratio</td>
              <td>${truncateToTwoDecimals(x.angle_and_length_ratio)}</td>
          </tr>
          <tr>
              <td>gsi_min_width</td>
              <td>${x.gsi_min_width}</td>
          </tr>
          <tr>
              <td>gsi_avg_width</td>
              <td>${x.gsi_avg_width}</td>
          </tr>
          <tr>
              <td>is_alpsmap</td>
              <td>${x.is_alpsmap}</td>
          </tr>
          <tr>
              <td>alpsmap_min_width</td>
              <td>${x.alpsmap_min_width}</td>
          </tr>
          <tr>
              <td>alpsmap_avg_width</td>
              <td>${x.alpsmap_avg_width}</td>
          </tr>
        </table>

        
        <span style="font-weight:bold;">Original</span>
        <table style="width:100%;" border="1">
          <tr>
              <td>length</td>
              <td>${truncateToTwoDecimals(x.length)}</td>
          </tr>
          <tr>
              <td>lanes</td>
              <td>${x.lanes}</td>
          </tr>
          <tr>
              <td>highway</td>
              <td>${x.highway}</td>
          </tr>
        </table>


        <span style="font-weight:bold;">Application</span>
        <table style="width:100%;" border="1">
          <tr>
              <td>googlemap</td>
              <td><a href="${
                x.google_map_url
              }" target="_blank">mapRouteUrl</a></td>
          </tr>
          <tr>
              <td>street_viewer</td>
              <td><a href="${
                x.street_view_url
              }" target="_blank">streetViewCenter</a></td>
          </tr>
          <tr>
              <td>google_earth</td>
              <td><a href="${
                x.google_earth_url
              }" target="_blank">googleEarthCenter</a></td>
          </tr>
        </table>`,
        { maxWidth: 400 }
      )
      .addTo(map);
    polylines.push(line);
  });
};

export const addPin = (lat, lng) => {
  L.marker([lat, lng]).addTo(map);
};

const filter = (targets) => {
  const filterKey1 = document.getElementById("filterKey1").value;
  const filterValue = document.getElementById("filterValue").value;
  targets =
    filterValue === "" || filterKey1 === ""
      ? target
      : target.filter((x) => x[filterKey1] == filterValue);

  const filterKey2 = document.getElementById("filterKey2").value;
  const minValue = document.getElementById("minValue").value;
  const maxValue = document.getElementById("maxValue").value;
  targets =
    filterKey2 === "" || minValue === ""
      ? targets
      : targets.filter((x) => x[filterKey2] >= Number(minValue));
  targets =
    filterKey2 === "" || maxValue === ""
      ? targets
      : targets.filter((x) => x[filterKey2] <= Number(maxValue));
  return targets;
};

const calcScore = (targets) => {
  // 重み
  const WEIGHTS = {
    elevation: Number(document.getElementById("weightElevation").value),
    elvation_over_height: Number(
      document.getElementById("weightElvationOverHeight").value
    ),
    elevation_u_shape: Number(
      document.getElementById("weightElevationUShape").value
    ),
    angle: Number(document.getElementById("weightAngle").value),
    width: Number(document.getElementById("weightWidth").value),
    length: Number(document.getElementById("weightLength").value),
  };

  // スコア計算
  targets = targets.map((x) => {
    x.score =
      (x.score_elevation * WEIGHTS["elevation"] +
        (1 - x.score_elevation_over_heiht * WEIGHTS["elvation_over_height"]) +
        x.score_elevation_u_shape * WEIGHTS["elevation_u_shape"] +
        x.score_angle * WEIGHTS["angle"] +
        x.score_width * WEIGHTS["width"] +
        x.score_length * WEIGHTS["length"]) /
      Object.keys(WEIGHTS).length;
    return x;
  });

  // 正規化
  const maxScore = Math.max(...targets.map((x) => x.score));
  const minScore = Math.min(...targets.map((x) => x.score));
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
