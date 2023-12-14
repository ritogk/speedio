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

  // 緯度時計を逆転させる
  var polylines = target.map((x) => {
    return {
      geometory: x.geometry.map((point) => [point[1], point[0]]),
      rate_normalized: x.rate_normalized,
      rate: x.rate,
      height_diff_rate: x.height_diff_rate,
      geometory_angle_total: x.geometory_angle_total,
      geometory_angle_rate: x.geometory_angle_rate,
      length: x.length,
    };
  });

  // // geometory_angle_rateが0.3~0.6のレコードを取得
  // polylines = polylines.filter(
  //   (x) => x.geometory_angle_rate > 0.25 && x.geometory_angle_rate < 0.6
  // );

  // // polylines.rateの上位10件のレコードを取得
  // polylines = polylines.sort((a, b) => b.rate - a.rate).slice(0, 10);

  polylines.forEach((x) => {
    const polyline = x.geometory;
    const rateNormalized = x.rate_normalized;
    const ed = polyline[polyline.length - 1];
    const center = polyline[Math.floor(polyline.length / 2)];
    const st = polyline[0];
    const streetViewStUrl = `https://www.google.com/maps/@${st[0]},${st[1]},20?layer=c&cbll=${st[0]},${st[1]}&cbp=12,0,0,0,0`;
    const streetViewCenterUrl = `https://www.google.com/maps/@${center[0]},${center[1]},20?layer=c&cbll=${center[0]},${center[1]}&cbp=12,0,0,0,0`;
    const streetViewEdUrl = `https://www.google.com/maps/@${ed[0]},${ed[1]},20?layer=c&cbll=${ed[0]},${ed[1]}&cbp=12,0,0,0,0`;
    const mapRouteUrl = `https://www.google.co.jp/maps/dir/${st[0]},${st[1]}/'${ed[0]},${ed[1]}'`;
    const googleEarthCenterUrl = `https://earth.google.com/web/search/${center[0]},+${center[1]}`;

    var color;
    var r = 255 * rateNormalized;
    var g = 0;
    var b = 255 * (1 - rateNormalized);
    color = "rgb(" + r + " ," + g + "," + b + ")";

    L.polyline(polyline, {
      color: color,
      weight: 20,
      opacity: 0.3 + 0.2 * rateNormalized,
    })
      .bindPopup(
        `
        center: <a href="${mapRouteUrl}" target="_blank">mapRouteUrl</a><br><br>
            center: <a href="${streetViewCenterUrl}" target="_blank">streetViewCenter</a><br><br>
            center: <a href="${googleEarthCenterUrl}" target="_blank">googleEarthCenter</a><br><br>
            rate_normalized: ${rateNormalized}<br><br>
            rate: ${x.rate}<br><br>
            height_diff_rate: ${x.height_diff_rate}<br><br>
            geometory_angle_total: ${x.geometory_angle_total}<br><br>
            geometory_angle_rate: ${x.geometory_angle_rate}<br><br>
            length: ${x.length}<br><br>
            `,
        { maxWidth: 400 }
      )
      .addTo(map);
  });
};
