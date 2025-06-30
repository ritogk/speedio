import { generateGoogleMapUrl } from "./generateGoogleMapUrl.js";
export const generateHtml = (x, isSmartPhone) => {
  return `${
    isSmartPhone
      ? '<div style="padding: 10px; background:white;transform: scale(1.7); transform-origin: top left; box-sizing: border-box;width:100%">'
      : "<div>"
  }
        <span style="font-weight:bold;">parent_score</span>
        <table style="width:100%;" border="1">
          <tr style="background:bisque;">
              <td>score_normalization</td>
              <td>${truncateToTwoDecimals(x.score_normalization)}</td>
          </tr>
          <tr style="background:bisque;">
              <td>score</td>
              <td>${truncateToTwoDecimals(x.score)}</td>
          </tr>
          <tr style="background: lightcyan;">
              <td>score_elevation</td>
              <td>${truncateToTwoDecimals(x.score_elevation)}</td>
          </tr>
          <tr style="background: lightcyan;">
              <td>score_elevation_unevenness</td>
              <td>${truncateToTwoDecimals(x.score_elevation_unevenness)}</td>
          </tr>
          <tr>
              <td>score_width</td>
              <td>${truncateToTwoDecimals(x.score_width)}</td>
          </tr>
          <tr>
              <td>score_length</td>
              <td>${truncateToTwoDecimals(x.score_length)}</td>
          </tr>
          <tr>
              <td>score_building</td>
              <td>${truncateToTwoDecimals(x.score_building)}</td>
          </tr>
          <tr>
              <td>score_tunnel_outside</td>
              <td>${truncateToTwoDecimals(x.score_tunnel_outside)}</td>
          </tr>
          <tr style="background: #ffe1fe">
              <td>score_corner_week</td>
              <td>${truncateToTwoDecimals(x.score_corner_week)}</td>
          </tr>
          <tr style="background: #ffe1fe">
              <td>score_corner_medium</td>
              <td>${truncateToTwoDecimals(x.score_corner_medium)}</td>
          </tr>
          <tr style="background: #ffe1fe">
              <td>score_corner_strong</td>
              <td>${truncateToTwoDecimals(x.score_corner_strong)}</td>
          </tr>
          <tr style="background: #ffe1fe">
              <td>score_corner_none</td>
              <td>${truncateToTwoDecimals(x.score_corner_none)}</td>
          </tr>
          <tr style="background: mistyrose">
              <td>score_corner_balance</td>
              <td>${truncateToTwoDecimals(x.score_corner_balance)}</td>
          </tr>
          <tr style="background: mistyrose">
              <td>score_center_line_section</td>
              <td>${truncateToTwoDecimals(x.score_center_line_section)}</td>
          </tr>
        </table>

        <span style="font-weight:bold;">child_score</span>
        <table style="width:100%;" border="1">
          <tr>
              <td>building_nearby_cnt</td>
              <td>${truncateToTwoDecimals(x.building_nearby_cnt)}</td>
          </tr>
          <tr>
              <td>road_section_cnt</td>
              <td>${truncateToTwoDecimals(x.road_section_cnt)}</td>
          </tr>
          <tr>
              <td>elevation_height</td>
              <td>${truncateToTwoDecimals(x.elevation_height)}</td>
          </tr>
          <tr>
              <td>elevation_unevenness_count</td>
              <td>${truncateToTwoDecimals(x.elevation_unevenness_count)}</td>
          </tr>
          <tr>
              <td>steering_wheel_max_angle</td>
              <td>${truncateToTwoDecimals(x.steering_wheel_max_angle)}</td>
          </tr>
          <tr>
              <td>steering_wheel_avg_angle</td>
              <td>${truncateToTwoDecimals(x.steering_wheel_avg_angle)}</td>
          </tr>
          <tr>
              <td>tunnel_length</td>
              <td>${truncateToTwoDecimals(x.tunnel_length)}</td>
          </tr>
          <tr>
              <td>length</td>
              <td>${truncateToTwoDecimals(x.length)}</td>
          </tr>
          <tr>
              <td>tunnel</td>
              <td>${x.tunnel}</td>
          </tr>
          <tr>
              <td>bridge</td>
              <td>${x.bridge}</td>
          </tr>
        </table>

        <button class="large-button" onclick="window.open('${generateGoogleMapUrl(
          x.geometry_list
        )}', '_blank')"
        >GoogleMapで表示</button><br>

        <button id="button3D" class="large-button">3Dで表示</button><br>

        <button id="button3dDriverView" class="large-button">3Dで表示(運転者目線)</button><br>

        <button id="buttonElevationGraph" class="large-button">標高グラフを表示</button><br>

        <span style="font-weight:bold;">Original</span>
        <table style="width:100%;" border="1">
          <tr>
              <td>name</td>
              <td>${x.name}</td>
          </tr>
        </table>


        <span style="font-weight:bold;">Application</span>
        <table style="width:100%;" border="1">
          <tr>
              <td>googlemap</td>
              <td><a href="${generateGoogleMapUrl(
                x.geometry_list
              )}" target="_blank">mapRouteUrl</a></td>
          </tr>
          <tr>
              <td>street_viewer</td>
              <td><a href="${
                x.street_view_url
              }" target="_blank">streetViewCenter</a></td>
          </tr>
          <tr>
              <td>street_viewer_url_list</td>
              <td>${x.google_map_url_list}"</td>
          </tr>
          <tr>
              <td>google_earth</td>
              <td><a href="${
                x.google_earth_url
              }" target="_blank">googleEarthCenter</a></td>
          </tr>
        </table></div>`;
};

// 数値を小数点2桁で丸める
const truncateToTwoDecimals = (value) => {
  return Math.floor(value * 1000) / 1000;
};
