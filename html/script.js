function initMap() {
  const map = new google.maps.Map(document.getElementById("map"), {
    zoom: 12,
    center: { lat: 35.682839, lng: 139.759455 }, // マップの中心座標
  })

  const directionsService = new google.maps.DirectionsService()

  // DirectionsRendererの配列を作成
  const directionsRenderers = []

  // ルート1の設定
  const route1 = {
    origin: new google.maps.LatLng(35.682839, 139.759455), // 出発地
    destination: new google.maps.LatLng(35.678003, 139.763659), // 目的地
    travelMode: google.maps.TravelMode.DRIVING, // 交通手段（運転）
  }

  // ルート2の設定
  const route2 = {
    origin: new google.maps.LatLng(35.682839, 139.759455), // 出発地
    destination: new google.maps.LatLng(35.678003, 139.763659), // 目的地
    travelMode: google.maps.TravelMode.DRIVING, // 交通手段（運転）
  }

  // DirectionsRendererを作成し、地図に追加
  const renderer1 = new google.maps.DirectionsRenderer({
    map: map,
  })
  directionsRenderers.push(renderer1)

  const renderer2 = new google.maps.DirectionsRenderer({
    map: map,
  })
  directionsRenderers.push(renderer2)

  // ルート1を描画
  directionsService.route(route1, function (result, status) {
    if (status === google.maps.DirectionsStatus.OK) {
      renderer1.setDirections(result)
    } else {
      console.error("ルート1を描画できませんでした：" + status)
    }
  })

  // ルート2を描画
  directionsService.route(route2, function (result, status) {
    if (status === google.maps.DirectionsStatus.OK) {
      renderer2.setDirections(result)
    } else {
      console.error("ルート2を描画できませんでした：" + status)
    }
  })
}
