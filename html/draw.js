import target from "./target.json" assert { type: "json" };
import * as L from "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/+esm";

document.getElementById("filter").addEventListener("change", function (e) {
  draw(e.target.value);
});

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

export const draw = (filterType) => {
  clearPolylines();
  let filteredTargets =
    filterType === "all"
      ? target
      : target.filter((x) => x.is_alpsmap === Number(filterType));

  filteredTargets.forEach((x) => {
    const polyline = x.geometry_list;
    const scoreNormalization = x.score_normalization;
    const ed = polyline[polyline.length - 1];
    const center = polyline[Math.floor(polyline.length / 2)];
    const st = polyline[0];

    var color;
    var r = 255 * scoreNormalization;
    var g = 0;
    var b = 255 * (1 - scoreNormalization);
    color = "rgb(" + r + " ," + g + "," + b + ")";

    const line = L.polyline(polyline, {
      color: color,
      weight: 20,
      opacity: 0.3 + 0.2 * scoreNormalization,
    })
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
              <td>elevation_deltas_and_length_radio</td>
              <td>${truncateToTwoDecimals(
                x.elevation_deltas_and_length_radio
              )}</td>
          </tr>
          <tr>
              <td>elavation_height_and_length_ratio</td>
              <td>${truncateToTwoDecimals(
                x.elavation_height_and_length_ratio
              )}</td>
          </tr>
          <tr>
              <td>angle_deltas</td>
              <td>${truncateToTwoDecimals(x.angle_deltas)}</td>
          </tr>
          <tr>
              <td>angle_and_length_ratio</td>
              <td>${truncateToTwoDecimals(x.angle_and_length_radio)}</td>
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
