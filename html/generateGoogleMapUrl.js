export const generateGoogleMapUrl = (geometry_list) => {
  const startPoint = geometry_list[0];
  const endPoint = geometry_list[geometry_list.length - 1];
  const centerIndex = Math.floor(geometry_list.length / 2);
  const centerPoint = geometry_list[centerIndex];
  const startLat = startPoint[0];
  const startLng = startPoint[1];
  const endLat = endPoint[0];
  const endLng = endPoint[1];
  const centerLat = centerPoint[0];
  const centerLng = centerPoint[1];
  return `https://www.google.co.jp/maps/dir/${startLat},${startLng}/${centerLat},${centerLng}/${endLat},${endLng}`;
  // return `https://www.google.co.jp/maps/dir/My+Location/${startLat},${startLng}/${centerLat},${centerLng}/${endLat},${endLng}`;
};
