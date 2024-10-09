export const generateHtml = (x) => {
  return `<span style="font-weight:bold;">Score</span>
        <table style="width:100%;" border="1">
          <tr style="background:bisque;">
              <td>score_normalization</td>
              <td>${truncateToTwoDecimals(x.score_normalization)}</td>
          </tr>
          <tr style="background:bisque;">
              <td>score</td>
              <td>${truncateToTwoDecimals(x.score)}</td>
          </tr>
          <tr>
              <td>score_angle</td>
              <td>${truncateToTwoDecimals(x.score_angle)}</td>
          </tr>
          <tr style="background: lightcyan;">
              <td>score_elevation</td>
              <td>${truncateToTwoDecimals(x.score_elevation)}</td>
          </tr>
          <tr style="background: lightcyan;">
              <td>score_elevation_deviation</td>
              <td>${truncateToTwoDecimals(x.score_elevation_deviation)}</td>
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
          <tr style="background: mistyrose">
              <td>score_corner_week</td>
              <td>${truncateToTwoDecimals(x.score_corner_week)}</td>
          </tr>
          <tr style="background: mistyrose">
              <td>score_corner_medium</td>
              <td>${truncateToTwoDecimals(x.score_corner_medium)}</td>
          </tr>
          <tr style="background: mistyrose">
              <td>score_corner_strong</td>
              <td>${truncateToTwoDecimals(x.score_corner_strong)}</td>
          </tr>
          <tr style="background: mistyrose">
              <td>score_corner_none</td>
              <td>${truncateToTwoDecimals(x.score_corner_none)}</td>
          </tr>
          <tr style="background: mistyrose">
              <td>score_corner_balance</td>
              <td>${truncateToTwoDecimals(x.score_corner_balance)}</td>
          </tr>
        </table>
        <button onclick="document.getElementById('graphArea').hidden=false;">Graph</button>
        <div id="graphArea" hidden>
            <canvas id="graphCanvas" width="600" height="400" style="background-color: white;"></canvas>
            <canvas id="graphElevationCanvas" width="1000" height="600" style="background-color: white;"></canvas>
        </div><br>
        <button onclick="document.getElementById('road3DArea').hidden=false;">3D</button>
        <div id="road3DArea" style="height:300px" hidden>
            <span style="font-weight:bold;">3D</span>
        </div>

        <span style="font-weight:bold;">Created</span>
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
          <tr>
              <td>steering_wheel_max_angle</td>
              <td>${truncateToTwoDecimals(x.steering_wheel_max_angle)}</td>
          </tr>
          <tr>
              <td>steering_wheel_avg_angle</td>
              <td>${truncateToTwoDecimals(x.steering_wheel_avg_angle)}</td>
          </tr>
        </table>

        
        <span style="font-weight:bold;">Original</span>
        <table style="width:100%;" border="1">
          <tr>
              <td>name</td>
              <td>${x.name}</td>
          </tr>
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
          <tr>
              <td>tunnel</td>
              <td>${x.tunnel}</td>
          </tr>
          <tr>
              <td>bridge</td>
              <td>${x.bridge}</td>
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
              <td>street_viewer_url_list</td>
              <td>${x.google_map_url_list}"</td>
          </tr>
          <tr>
              <td>google_earth</td>
              <td><a href="${
                x.google_earth_url
              }" target="_blank">googleEarthCenter</a></td>
          </tr>
        </table>`;
};

// 数値を小数点2桁で丸める
const truncateToTwoDecimals = (value) => {
  return Math.floor(value * 1000) / 1000;
};
