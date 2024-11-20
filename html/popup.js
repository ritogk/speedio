export const generateHtml = (x, isSmartPhone) => {
  return `${
    isSmartPhone
      ? '<div style="padding: 10px; background:white;transform: scale(1.7); transform-origin: top left; box-sizing: border-box;width:100%">'
      : "<div>"
  }
        <span style="font-weight:bold;">スコア_内訳</span>
        <table style="width:100%;" border="1">
          <tr style="background:bisque;">
              <td>スコア_合計_正規化</td>
              <td>${truncateToTwoDecimals(x.score_normalization)}</td>
          </tr>
          <tr style="background:bisque;">
              <td>スコア_合計</td>
              <td>${truncateToTwoDecimals(x.score)}</td>
          </tr>
          <tr style="background: lightcyan;">
              <td>スコア_標高</td>
              <td>${truncateToTwoDecimals(x.score_elevation)}</td>
          </tr>
          <tr style="background: lightcyan;">
              <td>スコア_標高_凹凸</td>
              <td>${truncateToTwoDecimals(x.score_elevation_unevenness)}</td>
          </tr>
          <tr>
              <td>スコア_道幅</td>
              <td>${truncateToTwoDecimals(x.score_width)}</td>
          </tr>
          <tr>
              <td>スコア_距離</td>
              <td>${truncateToTwoDecimals(x.score_length)}</td>
          </tr>
          <tr>
              <td>スコア_周辺の建物の数</td>
              <td>${truncateToTwoDecimals(x.score_building)}</td>
          </tr>
          <tr>
              <td>スコア_トンネル外の距離</td>
              <td>${truncateToTwoDecimals(x.score_tunnel_outside)}</td>
          </tr>
          <tr style="background: #ffe1fe">
              <td>スコア_コーナー_弱</td>
              <td>${truncateToTwoDecimals(x.score_corner_week)}</td>
          </tr>
          <tr style="background: #ffe1fe">
              <td>スコア_コーナー_中</td>
              <td>${truncateToTwoDecimals(x.score_corner_medium)}</td>
          </tr>
          <tr style="background: #ffe1fe">
              <td>スコア_コーナー_強</td>
              <td>${truncateToTwoDecimals(x.score_corner_strong)}</td>
          </tr>
          <tr style="background: #ffe1fe">
              <td>スコア_コーナー_なし(直線)</td>
              <td>${truncateToTwoDecimals(x.score_corner_none)}</td>
          </tr>
          <tr style="background: mistyrose">
              <td>スコア_コーナー_バランス</td>
              <td>${truncateToTwoDecimals(x.score_corner_balance)}</td>
          </tr>
        </table>

        <span style="font-weight:bold;">スコア_内訳の構成要素</span>
        <table style="width:100%;" border="1">
          <tr>
              <td>周辺の建物の数</td>
              <td>${truncateToTwoDecimals(x.building_nearby_cnt)}</td>
          </tr>
          <tr>
              <td>区間数</td>
              <td>${truncateToTwoDecimals(x.road_section_cnt)}</td>
          </tr>
          <tr>
              <td>標高の高低差</td>
              <td>${truncateToTwoDecimals(x.elevation_height)}</td>
          </tr>
          <tr>
              <td>標高の凹凸数</td>
              <td>${truncateToTwoDecimals(x.elevation_unevenness_count)}</td>
          </tr>
          <tr>
              <td>ハンドルの最大切れ角</td>
              <td>${truncateToTwoDecimals(x.steering_wheel_max_angle)}</td>
          </tr>
          <tr>
              <td>ハンドルの平均切れ角</td>
              <td>${truncateToTwoDecimals(x.steering_wheel_avg_angle)}</td>
          </tr>
          <tr>
              <td>トンネルの区間距離</td>
              <td>${truncateToTwoDecimals(x.tunnel_length)}</td>
          </tr>
          <tr>
              <td>距離</td>
              <td>${truncateToTwoDecimals(x.length)}</td>
          </tr>
          <tr>
              <td>トンネル(あり,なし)</td>
              <td>${x.tunnel}</td>
          </tr>
          <tr>
              <td>橋(あり,なし)</td>
              <td>${x.bridge}</td>
          </tr>
        </table>

        <button class="large-button" onclick="window.open('${
          x.google_map_url
        }', '_blank')"
        >GoogleMapで表示</button><br>

        <button id="button3D" class="large-button">3Dで表示</button><br>

        <button id="button3dDriverView" class="large-button">3Dで表示(運転者目線)</button><br>

        <button id="buttonElevationGraph" class="large-button">標高グラフを表示</button><br>
        
        <span style="font-weight:bold;">Original</span>
        <table style="width:100%;" border="1">
          <tr>
              <td>名称</td>
              <td>${x.name}</td>
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
        </table></div>`;
};

// 数値を小数点2桁で丸める
const truncateToTwoDecimals = (value) => {
  return Math.floor(value * 1000) / 1000;
};
