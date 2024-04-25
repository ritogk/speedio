<script setup lang="ts">
import { provide } from 'vue'
import { Loader } from '@googlemaps/js-api-loader'
import {
  useHomeState,
  UseHomeStateKey,
  type PointType,
  type RoadConditionType
} from '@/pages/home-parts/home-state'
const apiKey = import.meta.env.VITE_GOOGLE_MAP_API_KEY

let map: google.maps.Map | null = null
let marker: google.maps.Marker | null = null
let polyline: google.maps.Polyline | null = null
let panorama: google.maps.StreetViewPanorama | null = null

const initGoogleService = async (polyline: PointType[], point: PointType): Promise<void> => {
  const loader = new Loader({
    apiKey: apiKey,
    version: 'weekly',
    libraries: ['places']
  })
  // このへんの処理で初期値をセットしているが先の処理で更新しているので消したい。
  const MapsLibrary = await loader.importLibrary('maps')
  map = new MapsLibrary.Map(document.getElementById('map') as HTMLElement, {
    center: { lat: point.latitude, lng: point.longitude },
    zoom: 13
  })
  const resultPanorama = await loader.importLibrary('streetView')
  const nextIndex = findClosestPointIndex(polyline, point) + 1
  const nextPoint = originalGeometries.value[selectedGeometryIndex.value][nextIndex]
  panorama = new resultPanorama.StreetViewPanorama(document.getElementById('pano') as HTMLElement, {
    position: { lat: point.latitude, lng: point.longitude },
    pov: {
      heading: calculateHeading(selectedGeometryPoint, nextPoint),
      pitch: 10
    }
  })
}

const homeState = useHomeState()
provide(UseHomeStateKey, homeState)

const {
  loadGeometries,
  isLoaded,
  originalGeometries,
  geometries,
  selectedGeometry,
  selectedGeometryIndex,
  selectedGeometryPoint,
  selectedGeometryPointIndex,
  changeSelectedGeometryPoint,
  changeSelectedGeometry
} = homeState

/**
 * csv読込
 * @param e
 */
const loadCsv = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const fileList = target.files as FileList
  if (!fileList.length) return
  const file = target.files?.[0]
  await loadGeometries(file)

  if (map === null && panorama === null && polyline === null) {
    await initGoogleService(
      originalGeometries.value[selectedGeometryIndex.value],
      selectedGeometryPoint.value
    )
  }
  updatePanorama(selectedGeometryPoint.value)
  updateMap(originalGeometries.value[selectedGeometryIndex.value])
  updateMapMarker(selectedGeometryPoint.value)
}

/**
 * ジオメトリーの切替
 * @param index
 */
const handleGeometryMove = (index: number) => {
  changeSelectedGeometry(index)
  changeSelectedGeometryPoint(0)
  updatePanorama(selectedGeometryPoint.value)
  updateMap(originalGeometries.value[selectedGeometryIndex.value])
  updateMapMarker(selectedGeometryPoint.value)
}

/**
 * ポイント選択
 * @param index
 */
const handlePointMove = (index: number) => {
  changeSelectedGeometryPoint(index)
  updatePanorama(selectedGeometryPoint.value)
  updateMapMarker(selectedGeometryPoint.value)
}

/**
 * street-viewの更新
 */
const updatePanorama = (selectedGeometryPoint: PointType) => {
  const nextIndex =
    findClosestPointIndex(
      originalGeometries.value[selectedGeometryIndex.value],
      selectedGeometryPoint
    ) + 1
  const nextPoint = originalGeometries.value[selectedGeometryIndex.value][nextIndex]
  panorama = new google.maps.StreetViewPanorama(document.getElementById('pano') as HTMLElement, {
    position: {
      lat: selectedGeometryPoint.latitude,
      lng: selectedGeometryPoint.longitude
    },
    pov: {
      heading: calculateHeading(selectedGeometryPoint, nextPoint),
      pitch: 10
    }
  })
}

/**
 * ポリラインの更新
 */
const updateMap = (geometry: PointType[]) => {
  // ポリライン更新
  polyline?.setMap(null)
  polyline = new google.maps.Polyline({
    path: geometry.map((point) => {
      return { lat: point.latitude, lng: point.longitude }
    }),
    geodesic: true,
    strokeColor: '#FF0000',
    strokeOpacity: 1.0,
    strokeWeight: 2
  })
  polyline.setMap(map)

  // 中央座標の更新
  map?.setCenter({
    lat: selectedGeometry.value[Math.floor(selectedGeometry.value.length / 2)].latitude,
    lng: selectedGeometry.value[Math.floor(selectedGeometry.value.length / 2)].longitude
  })
}

/**
 * マーカーの更新
 * @param point
 */
const updateMapMarker = (point: PointType) => {
  marker?.setMap(null)
  marker = new google.maps.Marker({
    position: {
      lat: point.latitude,
      lng: point.longitude
    },
    map: map,
    title: 'Hello World!'
  })
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

const handleRoadCondtionClick = (roadCondition: RoadConditionType) => {}
</script>

<template>
  <div style="display: flex; width: 100%">
    <div style="flex: 7; height: 750px">
      <div id="pano" style="flex: 5; background-color: gray; height: 750px">street_view_area</div>
      <div style="width: 100%">
        <div class="button-container">
          <button
            class="button-style"
            data-tooltip="2車線かつ路肩あり"
            style="background: palegreen"
          >
            1
          </button>
          <button
            class="button-style"
            data-tooltip="2車線かつ路肩なし"
            style="background: palegreen"
          >
            2
          </button>
          <button
            class="button-style"
            data-tooltip="1車線かつ2台が余裕を持って通行可能"
            style="background: bisque"
          >
            3
          </button>
          <button
            class="button-style"
            data-tooltip="1車線かつ1台のみ通行可能"
            style="background: bisque"
          >
            4
          </button>
          <button
            class="button-style"
            data-tooltip="戻る"
            @click="handlePointMove(selectedGeometryPointIndex - 1)"
            :disabled="selectedGeometryPointIndex == 0"
          >
            ◀
          </button>
          <button
            class="button-style"
            data-tooltip="進む"
            @click="handlePointMove(selectedGeometryPointIndex + 1)"
            :disabled="selectedGeometryPointIndex + 1 == selectedGeometry.length"
          >
            ▶
          </button>
          <span style="margin-left: 10px"
            >{{ selectedGeometryPointIndex + 1 }}/{{ selectedGeometry.length }}</span
          >
        </div>
      </div>
    </div>
    <div id="map" style="flex: 2; background-color: darkgray; height: 750px">google_map_area</div>
    <div style="flex: 2; background-color: white">
      <table border="1" style="height: 750px; overflow-y: auto; display: block">
        <thead>
          <tr style="background: lightblue">
            <th>DB</th>
            <th>地理座標</th>
            <th>路面状態</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(point, index) in selectedGeometry"
            :key="`geometry-${index}`"
            @click="handlePointMove(index)"
            style="font-size: 11px"
            :style="{
              backgroundColor: index === selectedGeometryPointIndex ? 'greenyellow' : 'transparent'
            }"
          >
            <td scope="row">済</td>
            <td>{{ point.latitude.toFixed(5) }}, {{ point.longitude.toFixed(5) }}</td>
            <td>{{ point.roadCondition }}</td>
          </tr>
        </tbody>
      </table>
      <div>
        <button
          @click="handleGeometryMove(selectedGeometryIndex - 2)"
          :disabled="selectedGeometryIndex < 2 || isLoaded === false"
        >
          ◀◀
        </button>
        <button
          @click="handleGeometryMove(selectedGeometryIndex - 1)"
          :disabled="selectedGeometryIndex < 1 || isLoaded === false"
        >
          ◀
        </button>
        <button
          @click="handleGeometryMove(selectedGeometryIndex + 1)"
          :disabled="selectedGeometryIndex + 2 > geometries.length || isLoaded === false"
        >
          ▶
        </button>
        <button
          @click="handleGeometryMove(selectedGeometryIndex + 2)"
          :disabled="selectedGeometryIndex + 3 > geometries.length || isLoaded === false"
        >
          ▶▶
        </button>
        <span style="margin-right: 20px"
          >{{ selectedGeometryIndex + 1 }}/{{ geometries.length }}</span
        >
        <input type="file" @change="loadCsv" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.button-container .button-style {
  position: relative;
  width: 50px; /* ボタンの横幅を50pxに設定 */
  height: 50px; /* ボタンの高さを50pxに設定 */
  margin: 5px; /* ボタンの間に少し余白を設ける */
  font-size: 16px; /* テキストのサイズを調整 */
  border: 1px solid #222;
  border-radius: 3px;
}
.button-container {
  text-align: center;
}
.button-container button::after {
  content: attr(data-tooltip); /* data-tooltip属性からテキストを取得 */
  position: absolute;
  white-space: nowrap; /* テキストが折り返さないようにする */
  visibility: hidden;
  bottom: 100%; /* ボタンのすぐ上に配置 */
  left: 50%; /* 中央に配置 */
  transform: translateX(-50%); /* 左に50%分ずらして中央寄せ */
  padding: 5px 10px;
  color: #fff;
  background-color: #333;
  border-radius: 6px;
  z-index: 1000;
}

.button-container button:hover::after {
  visibility: visible; /* ホバー時に見えるように */
}
</style>
