<script setup lang="ts">
import { provide, computed, ref, watch } from 'vue'
import { Loader } from '@googlemaps/js-api-loader'
import {
  useHomeState,
  UseHomeStateKey,
  type PointType,
  type RoadWidthType
} from '@/pages/home-parts/home-state'
import { useGetLocations } from '@/core/api/use-get-locations'
import { usePostLocations } from '@/core/api/use-post-locations'
import { usePatchLocations } from '@/core/api/use-patch-locations'

import { onKeyStroke } from '@vueuse/core'
const apiKey = import.meta.env.VITE_API_KEY

let map: google.maps.Map | null = null
let marker: google.maps.Marker | null = null
let polyline: google.maps.Polyline | null = null
let panorama: google.maps.StreetViewPanorama | null = null

const { data: locations, setQueryParams } = useGetLocations()
const postLocations = usePostLocations()
const patchLocations = usePatchLocations()

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
  const nextPoint = filteredGeometries.value[selectedGeometryIndex.value][nextIndex]
  panorama = new resultPanorama.StreetViewPanorama(document.getElementById('pano') as HTMLElement, {
    position: { lat: point.latitude, lng: point.longitude },
    pov: {
      heading: calculateHeading(selectedGeometryPoint, nextPoint),
      pitch: 10
    }
  })
}

const selectedLocation = computed(() => {
  if (!locations.value) return null
  if (!selectedGeometryPoint.value) return null
  return (
    locations.value.find((location) => {
      return (
        location.point.coordinates[1] === selectedGeometryPoint.value.latitude &&
        location.point.coordinates[0] === selectedGeometryPoint.value.longitude
      )
    }) ?? null
  )
})

const homeState = useHomeState()
provide(UseHomeStateKey, homeState)

const {
  loadGeometries,
  isLoaded,
  originalGeometries,
  filteredGeometries,
  selectedGeometry,
  selectedGeometryIndex,
  selectedGeometryPoint,
  selectedGeometryPointIndex,
  changeSelectedGeometryPoint,
  changeSelectedGeometry,
  changeFilterGeometry
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
      filteredGeometries.value[selectedGeometryIndex.value],
      selectedGeometryPoint.value
    )
  }
  updatePanorama(selectedGeometryPoint.value)
  updateMap(selectedGeometry.value)
  updateMapMarker(selectedGeometryPoint.value)
}

/**
 * ジオメトリーの切替
 * @param index
 */
const handleGeometryMove = (index: number) => {
  changeSelectedGeometry(index)
  changeSelectedGeometryPoint(1)
  updatePanorama(selectedGeometryPoint.value)
  updateMap(selectedGeometry.value)
  updateMapMarker(selectedGeometryPoint.value)

  // geometryからバウンディングボックス生成
  const lineString = selectedGeometry.value.map((point) => {
    return [point.longitude, point.latitude]
  })
  let minLongitude = lineString[0][0]
  let maxLongitude = lineString[0][0]
  let minLatitude = lineString[0][1]
  let maxLatitude = lineString[0][1]
  lineString.forEach((point) => {
    if (point[0] < minLongitude) minLongitude = point[0]
    if (point[0] > maxLongitude) maxLongitude = point[0]
    if (point[1] < minLatitude) minLatitude = point[1]
    if (point[1] > maxLatitude) maxLatitude = point[1]
  })
  // apiを呼び出す。
  setQueryParams({
    maxLatitude: maxLatitude,
    minLatitude: minLatitude,
    maxLongitude: maxLongitude,
    minLongitude: minLongitude
  })
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

let oldPano = ''
/**
 * street-viewの更新
 */
const updatePanorama = (selectedGeometryPoint: PointType) => {
  // チェック座標より１点先の座標を取得する。
  const nextPoint = getCheckNextPoint(selectedGeometryPoint)

  if (panorama) {
    panorama.setPosition({
      lat: selectedGeometryPoint.latitude,
      lng: selectedGeometryPoint.longitude
    })

    // 直前の画像と変わったかどうかを判定
    if (oldPano === panorama.getLocation().pano) {
      alert('画像がありません。')
      return
    }
    oldPano = panorama.getLocation().pano

    panorama.setPov({
      heading: calculateHeading(selectedGeometryPoint, nextPoint),
      pitch: 10
    })
  }
}

/**
 * ストリートビューの視点用。チェック用座標の１点先の座標を取得する。
 * @param selectedGeometryPoint
 */
const getCheckNextPoint = (selectedGeometryPoint: PointType) => {
  // チェック座標より１点先の座標を取得する。
  const originalGeometry = originalGeometries.value.find((geometry) => {
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

// 一覧に表示するデータ
const points = computed(() => {
  // selectedGeometryとdata.valueをもとに生成
  return selectedGeometry.value.map((point) => {
    const location = locations.value?.find((location) => {
      return (
        location.point.coordinates[1] === point.latitude &&
        location.point.coordinates[0] === point.longitude
      )
    })
    const roadWidthType = location?.road_width_type
    const hasCenterLine = location?.has_center_line

    return {
      check: location,
      label: location ? '済' : '未',
      latitude: point.latitude,
      longitude: point.longitude,
      roadWidthType: roadWidthType,
      hasCenterLine: hasCenterLine
    }
  })
})

const currentPoint = computed(() => {
  // 現在のジオメトリのポイントを取得
  return points.value[selectedGeometryPointIndex.value]
})

// 対象ジオメトリの評価済の座標数数
const selectedGeometryCheckCount = computed(() => {
  return filteredGeometries.value[selectedGeometryIndex.value].filter((point) => {
    if (!locations.value) return false
    return locations.value.some((location) => {
      return (
        point.latitude === location.point.coordinates[1] &&
        point.longitude === location.point.coordinates[0]
      )
    })
  }).length
})

const selectedRoadType = ref<RoadWidthType>('ONE_LANE')
const selectedBeforeRoadType = ref<RoadWidthType>('ONE_LANE')
/**
 * 路面状態更新ハンドラー
 * @param roadWidthType
 */
const handleRoadTypeClick = async (roadWidthType: RoadWidthType) => {
  selectedRoadType.value = roadWidthType
  if (!locations.value) return
  // locationsに含まれる座標の場合は更新
  const location = locations.value.find((location) => {
    return (
      location.point.coordinates[1] === selectedGeometryPoint.value.latitude &&
      location.point.coordinates[0] === selectedGeometryPoint.value.longitude
    )
  })
  if (location) {
    // 更新
    await patchLocations.mutateAsync({
      id: location.id,
      location: {
        road_width_type: selectedRoadType.value,
        has_center_line: false
      }
    })
  } else {
    // 新規
    await postLocations.mutateAsync({
      latitude: selectedGeometryPoint.value.latitude,
      longitude: selectedGeometryPoint.value.longitude,
      road_width_type: selectedRoadType.value,
      has_center_line: false
    })
  }

  // 最後のポイントの場合はジオメトリーを切り替える
  if (selectedGeometryPointIndex.value + 2 === selectedGeometry.value.length) {
    handleGeometryMove(selectedGeometryIndex.value + 1)
  } else {
    handlePointMove(selectedGeometryPointIndex.value + 1)
  }
  selectedBeforeRoadType.value = selectedRoadType.value
  selectedRoadType.value = 'ONE_LANE'
}

/**
 * センターラインの更新ハンドラー
 * @param roadWidthType
 */
const handleCenterlineClick = async (hasCenterLine: boolean) => {
  if (!locations.value) return
  // locationsに含まれる座標の場合は更新
  const location = locations.value.find((location) => {
    return (
      location.point.coordinates[1] === selectedGeometryPoint.value.latitude &&
      location.point.coordinates[0] === selectedGeometryPoint.value.longitude
    )
  })
  if (location) {
    // 更新
    await patchLocations.mutateAsync({
      id: location.id,
      location: {
        has_center_line: hasCenterLine
      }
    })
  } else {
    // 新規
    await postLocations.mutateAsync({
      latitude: selectedGeometryPoint.value.latitude,
      longitude: selectedGeometryPoint.value.longitude,
      road_width_type: selectedGeometryPoint.value.roadWidthType,
      has_center_line: hasCenterLine
    })
  }

  // 最後のポイントの場合はジオメトリーを切り替える
  if (selectedGeometryPointIndex.value + 2 === selectedGeometry.value.length) {
    handleGeometryMove(selectedGeometryIndex.value + 1)
  } else {
    handlePointMove(selectedGeometryPointIndex.value + 1)
  }
  selectedBeforeRoadType.value = selectedRoadType.value
  selectedRoadType.value = 'ONE_LANE'
}

/**
 * フィルターをかける
 */
const handleChangeFilterGeometryClick = () => {
  changeFilterGeometry()
  // filteredGeometriesの値が変わった後に各値を初期化する
  handleGeometryMove(0)
}

// onKeyStroke(['z'], (e) => {
//   handleRoadTypeClick('TWO_LANE_SHOULDER')
//   e.preventDefault()
// })
onKeyStroke(['z'], (e) => {
  handleCenterlineClick(true)
  // handleRoadTypeClick('TWO_LANE')
  e.preventDefault()
})
onKeyStroke(['x'], (e) => {
  handleCenterlineClick(false)
  // handleRoadTypeClick('ONE_LANE_SPACIOUS')
  e.preventDefault()
})
onKeyStroke(['c'], (e) => {
  // handleRoadTypeClick('ONE_LANE')
  e.preventDefault()
})

// 進む
onKeyStroke(['\\'], (e) => {
  // 最後のポイントの場合はジオメトリーを切り替える
  if (selectedGeometryPointIndex.value + 1 === selectedGeometry.value.length) {
    handleGeometryMove(selectedGeometryIndex.value + 1)
  } else {
    handlePointMove(selectedGeometryPointIndex.value + 1)
  }
  selectedBeforeRoadType.value = selectedRoadType.value
  selectedRoadType.value = 'ONE_LANE'
  e.preventDefault()
})

// 戻る
onKeyStroke(['/'], (e) => {
  // // 最初のポイントの場合はジオメトリーを切り替える
  if (selectedGeometryPointIndex.value === 0) {
    handleGeometryMove(selectedGeometryIndex.value - 1)
  } else {
    handlePointMove(selectedGeometryPointIndex.value - 1)
  }

  e.preventDefault()
})

// 3つ進む
onKeyStroke(['End'], (e) => {
  // 最後のポイントの場合はジオメトリーを切り替える
  if (selectedGeometryPointIndex.value + 3 >= selectedGeometry.value.length) {
    handleGeometryMove(selectedGeometryIndex.value + 3)
  } else {
    handlePointMove(selectedGeometryPointIndex.value + 3)
  }
  selectedBeforeRoadType.value = selectedRoadType.value
  selectedRoadType.value = 'ONE_LANE'
  e.preventDefault()
})

// ジオメトリ移動(進む)
onKeyStroke([']'], (e) => {
  handleGeometryMove(selectedGeometryIndex.value + 1)
  e.preventDefault()
})
// ジオメトリ移動(戻る)
onKeyStroke([':'], (e) => {
  handleGeometryMove(selectedGeometryIndex.value - 1)
  e.preventDefault()
})

const geometryPointPageNoJump = ref(1)
</script>

<template>
  <div style="display: flex; width: 100%">
    <div style="flex: 7; height: 1000px">
      <div id="pano" style="flex: 5; background-color: gray; height: 1000px">street_view_area</div>
      <div style="width: 100%">
        <div class="button-container">
          <!-- 道幅 -->
          <span style="display: none">
            <button
              class="button-style"
              data-tooltip="2車線かつ路肩あり"
              style="background: palegreen"
              @click="handleRoadTypeClick('TWO_LANE_SHOULDER')"
              hidden
            >
              <span v-show="selectedRoadType === 'TWO_LANE_SHOULDER'" style="color: red">★</span>
              1
            </button>
            <button
              class="button-style"
              data-tooltip="2車線かつ路肩なし"
              style="background: palegreen"
              @click="handleRoadTypeClick('TWO_LANE')"
            >
              <span v-show="selectedRoadType === 'TWO_LANE'" style="color: red">★</span>
              2
            </button>
            <button
              class="button-style"
              data-tooltip="1車線かつ2台が余裕を持って通行可能"
              style="background: bisque"
              @click="handleRoadTypeClick('ONE_LANE_SPACIOUS')"
            >
              <span v-show="selectedRoadType === 'ONE_LANE_SPACIOUS'" style="color: red">★</span>
              3
            </button>
            <button
              class="button-style"
              data-tooltip="1車線かつ1台のみ通行可能"
              style="background: bisque"
              @click="handleRoadTypeClick('ONE_LANE')"
            >
              <span v-show="selectedRoadType === 'ONE_LANE'" style="color: red">★</span>
              4
            </button>
            -
          </span>
          <!-- center-line-->
          <div style="background: red" v-show="currentPoint?.roadWidthType == 'TWO_LANE'">--</div>
          <span>
            <button
              class="button-style"
              data-tooltip="center-lineあり"
              style="background: bisque"
              @click="handleCenterlineClick(true)"
            >
              <span v-show="selectedLocation?.has_center_line" style="color: red">★</span>
              yes
            </button>
            <button
              class="button-style"
              data-tooltip="center-lineなし"
              style="background: bisque"
              @click="handleCenterlineClick(false)"
            >
              <span v-show="!selectedLocation?.has_center_line" style="color: red">★</span>
              no
            </button>
          </span>
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
          <span style="margin-left: 30px"
            >checked:<span style="color: red">{{ selectedGeometryCheckCount }}</span></span
          >
        </div>
      </div>
    </div>
    <div id="map" style="flex: 2; background-color: darkgray; height: 1000px">google_map_area</div>
    <div style="flex: 2; background-color: white">
      <table border="1" style="height: 1000px; overflow-y: auto; display: block">
        <thead>
          <tr style="background: lightblue">
            <th>DB</th>
            <th>地理座標</th>
            <th>路面状態</th>
            <th>ｾﾝﾀｰﾗｲﾝ</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(point, index) in points"
            :key="`geometry-${index}`"
            @click="handlePointMove(index)"
            style="font-size: 11px"
            :style="{
              backgroundColor: index === selectedGeometryPointIndex ? 'greenyellow' : 'transparent'
            }"
          >
            <td
              scope="row"
              :style="{
                color: point.check ? 'red' : 'black'
              }"
            >
              {{ point.label }}
            </td>
            <td>{{ point.latitude }}, {{ point.longitude }}</td>
            <td
              :style="{
                backgroundColor: point.roadWidthType !== 'TWO_LANE' ? 'gray' : 'transparent'
              }"
            >
              {{ point.roadWidthType }}
            </td>
            <td>{{ point.hasCenterLine }}</td>
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
          :disabled="selectedGeometryIndex + 2 > filteredGeometries.length || isLoaded === false"
        >
          ▶
        </button>
        <button
          @click="handleGeometryMove(selectedGeometryIndex + 2)"
          :disabled="selectedGeometryIndex + 3 > filteredGeometries.length || isLoaded === false"
        >
          ▶▶</button
        ><span style="margin-right: 20px"
          >{{ selectedGeometryIndex + 1 }}/{{ filteredGeometries.length }}</span
        >
        <button @click="handleChangeFilterGeometryClick()">filter</button>
        <br />
        <input type="number" style="width: 50px" v-model="geometryPointPageNoJump" /><button
          @click="handleGeometryMove(Number(geometryPointPageNoJump - 1))"
        >
          change
        </button>
        <input type="file" @change="loadCsv" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.button-container .button-style {
  position: relative;
  width: 70px; /* ボタンの横幅を50pxに設定 */
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
  z-index: 10000;
}

.button-container button:hover::after {
  visibility: visible; /* ホバー時に見えるように */
}
</style>
