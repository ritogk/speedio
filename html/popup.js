export const generateHtml = (x) => {
  return `<span style="font-weight:bold;">Score</span>
        <table style="width:100%;" border="1">
          <tr>
              <td>score_normalization</td>
              <td>${truncateToTwoDecimals(x.score_normalization)}</td>
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
          <tr>
            <td>eye_measured_width</td>
            <td>${x.eye_measured_width}</td>
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
