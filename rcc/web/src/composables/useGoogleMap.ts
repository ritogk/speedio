    import { ref } from 'vue'
import { Loader } from '@googlemaps/js-api-loader'
import type { PointType } from '@/pages/home-parts/home-state'

export function useGoogleMap(apiKey: string) {
  // NOTE: googlemap系のオブジェクトをrefでラップすると正しく動作しなくなる。
  let map: google.maps.Map | null = null
  let marker: google.maps.Marker | null = null
  let polyline: google.maps.Polyline | null = null
  let panorama: google.maps.StreetViewPanorama | null = null

  // Googleサービス初期化
  const initGoogleService = async (polylinePoints: PointType[], point: PointType) => {
    const loader = new Loader({ 
      apiKey: apiKey,
      version: 'weekly',
      libraries: ['places']
    })
    const MapsLibrary = await loader.importLibrary('maps')
    map = new MapsLibrary.Map(document.getElementById('map') as HTMLElement, {
      center: { lat: point.latitude, lng: point.longitude },
      zoom: 13
    })
    const resultPanorama = await loader.importLibrary('streetView')
    panorama = new resultPanorama.StreetViewPanorama(
      document.getElementById('pano') as HTMLElement,
      {
        position: { lat: point.latitude, lng: point.longitude },
        pov: { heading: 0, pitch: 10 }
      }
    )
  }

  // ポリラインの更新
  const updateMap = (geometry: PointType[]) => {
    if(!map) return
    if(polyline != null){
        polyline.setMap(null)
    }
    polyline = new google.maps.Polyline({
      path: geometry.map((point) => ({ lat: point.latitude, lng: point.longitude })),
      geodesic: true,
      strokeColor: '#FF0000',
      strokeOpacity: 1.0,
      strokeWeight: 2
    })
    polyline.setMap(map)
    // 中央座標の更新
    map?.setCenter({
      lat: geometry[Math.floor(geometry.length / 2)].latitude,
      lng: geometry[Math.floor(geometry.length / 2)].longitude
    })
  }

  // マーカーの更新
  const updateMapMarker = (point: PointType) => {
    // 古いマーカーをすべて消す。
    if(marker != null){
        marker?.setMap(null)
        marker = null   
    }
    marker = new google.maps.Marker({
      position: { lat: point.latitude, lng: point.longitude },
      map: map,
      title: 'Hello World!'
    })
  }

  // パノラマの更新
  const updatePanorama = (point: PointType, heading: number = 0) => {
    if (panorama) {
      panorama.setPosition({ lat: point.latitude, lng: point.longitude })
      panorama.setPov({ heading, pitch: 10 })
    }
  }

  // --- 追加: GoogleMap系ユーティリティ関数 ---
  /**
   * ストリートビューの視点用。チェック用座標の１点先の座標を取得する。
   * @param selectedGeometryPoint
   * @param originalGeometries
   */
  const getCheckNextPoint = (
    selectedGeometryPoint: PointType,
    originalGeometries: PointType[][]
  ) => {
    // チェック座標より１点先の座標を取得する。
    const originalGeometry = originalGeometries.find((geometry) => {
      return geometry.some((point) => {
        if (
          point.latitude === selectedGeometryPoint.latitude &&
          point.longitude === selectedGeometryPoint.longitude
        ) {
          return true
        }
        return false
      })
    })
    if (!originalGeometry) return

    const originalGeometryPointIndex = originalGeometry.find((point) => {
      if (
        point.latitude === selectedGeometryPoint.latitude &&
        point.longitude === selectedGeometryPoint.longitude
      ) {
        return true
      }
      return false
    })
    if (!originalGeometryPointIndex) return

    const nextIndex = findClosestPointIndex(originalGeometry, originalGeometryPointIndex) + 1
    const nextPoint = originalGeometry[nextIndex]
    return nextPoint
  }

  /**
   * 座標間の視点を計算
   * @param point1
   * @param point2
   */
  const calculateHeading = (point1: any, point2: any): number => {
    if (!point1 || !point2) return 0
    const lat1 = (point1.latitude * Math.PI) / 180
    const lat2 = (point2.latitude * Math.PI) / 180
    const diffLong = ((point2.longitude - point1.longitude) * Math.PI) / 180

    const x = Math.sin(diffLong) * Math.cos(lat2)
    const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(diffLong)

    return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360
  }

  /**
   * 指定座標に最も近いポイントのインデックスを取得
   * @param points
   * @param targetXY
   */
  const findClosestPointIndex = (points: PointType[], targetXY: PointType): number => {
    const nextIndex = points.findIndex((point) => {
      if (point.latitude === targetXY.latitude && point.longitude === targetXY.longitude) {
        return true
      }
      return false
    })
    return nextIndex
  }

  return {
    map,
    marker,
    polyline,
    panorama,
    initGoogleService,
    updateMap,
    updateMapMarker,
    updatePanorama,
    getCheckNextPoint,
    calculateHeading,
    findClosestPointIndex
  }
} 