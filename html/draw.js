import target from "./target.json" assert { type: "json" };
import * as L from "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/+esm";

const latitude = 35.338218;
const longitude = 137.005638;
export const draw = () => {
  // 地図を初期化し、指定位置を中心にする
  const map = L.map("map").setView([latitude, longitude], 13);
  // OpenStreetMapのタイルレイヤーを追加
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // // geometory_angle_rateが0.3~0.6のレコードを取得
  // polylines = polylines.filter(
  //   (x) => x.geometory_angle_rate > 0.25 && x.geometory_angle_rate < 0.6
  // );

  // // 上位10件を抽出
  // target = target.sort((a, b) => b.score - a.score).slice(0, 10);

  // targetのscore_normalizationを大きい順に並び替える
  target.sort((a, b) => a.score_normalization - b.score_normalization);

  target.forEach((x) => {
    const polyline = x.geometry_list;
    debugger;
    const scoreNormalization = x.score_normalization;
    const ed = polyline[polyline.length - 1];
    const center = polyline[Math.floor(polyline.length / 2)];
    const st = polyline[0];

    var color;
    var r = 255 * scoreNormalization;
    var g = 0;
    var b = 255 * (1 - scoreNormalization);
    color = "rgb(" + r + " ," + g + "," + b + ")";

    L.polyline(polyline, {
      color: color,
      weight: 20,
      opacity: 0.3 + 0.2 * scoreNormalization,
    })
      .bindPopup(
        `
        center: <a href="${x.google_map_url}" target="_blank">mapRouteUrl</a><br><br>
            center: <a href="${x.street_view_url}" target="_blank">streetViewCenter</a><br><br>
            center: <a href="${x.google_earth_url}" target="_blank">googleEarthCenter</a><br><br>
            score_nomalization: ${scoreNormalization}<br><br>
            score: ${x.score}<br><br>
            elevation_change_rate: ${x.elevation_change_rate}<br><br>
            elevation_change_rate: ${x.elevation_change_amount}<br><br>
            angle_change_amount: ${x.angle_change_amount}<br><br>
            angle_change_rate: ${x.angle_change_rate}<br><br>
            length: ${x.length}<br><br>
            `,
        { maxWidth: 400 }
      )
      .addTo(map);
  });
};
