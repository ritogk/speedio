/**
 * JSONデータをファイルとしてダウンロード
 * @param {string} jsonString - JSONデータの文字列
 * @param {string} filename - ダウンロードするファイル名
 */
const downloadJSON = (jsonString, filename) => {
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * 動画データ（座標と標高）をダウンロード
 * @param {object} x - ターゲットオブジェクト
 */
export const downloadVideoData = (x) => {
  // video_coords_segment_list をダウンロード
  if (x.video_coords_segment_list) {
    const coordsData = JSON.stringify(x.video_coords_segment_list, null, 2);
    downloadJSON(coordsData, "coords_segment_list.json");
  }

  // video_elevation_segment_list をダウンロード
  if (x.video_elevation_segment_list) {
    const elevationData = JSON.stringify(x.video_elevation_segment_list, null, 2);
    downloadJSON(elevationData, "elevation_segment_list.json");
  }
};
