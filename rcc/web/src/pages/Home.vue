<script setup lang="ts">
import { provide, computed, ref, onMounted, onBeforeUnmount } from 'vue'
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

import 'leaflet/dist/leaflet.css'

const { data: locations, setQueryParams } = useGetLocations()
const postLocations = usePostLocations()
const patchLocations = usePatchLocations()

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
  const originalGeometry = originalGeometries.value[selectedGeometryIndex.value]
  updateMainMap(originalGeometry, selectedGeometryPoint.value)
  updateMap(originalGeometry)
  updateMapMarker(selectedGeometryPoint.value)
}

/**
 * ジオメトリーの切替
 * @param index
 */
const handleGeometryMove = (index: number) => {
  changeSelectedGeometry(index)
  changeSelectedGeometryPoint(1)
  const originalGeometry = originalGeometries.value[selectedGeometryIndex.value]
  updateMainMap(originalGeometry, selectedGeometryPoint.value)
  updateMap(originalGeometry)
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
  const originalGeometry = originalGeometries.value[selectedGeometryIndex.value]
  updateMainMap(originalGeometry, selectedGeometryPoint.value)
  updateMapMarker(selectedGeometryPoint.value)
}

/**
 * main-mapの更新
 */
const updateMainMap = (selectedOriginalGeometry: PointType[], selectedGeometryPoint: PointType) => {
  if (!gsiMapMain || !gsiMapMainContainer.value) return

  // gsiMapMainのポリラインとcircleを削除
  gsiMapMain.eachLayer((layer) => {
    if (!gsiMapMain) return
    if (layer instanceof L.Polyline || layer instanceof L.Circle) {
      gsiMapMain.removeLayer(layer)
    }
  })

  // 座標を移動
  gsiMapMain.setView([selectedGeometryPoint.latitude, selectedGeometryPoint.longitude], 18)

  // polylineを描画
  const latlngs: L.LatLngTuple[] = selectedOriginalGeometry.map((point) => {
    return [point.latitude, point.longitude]
  })
  L.polyline(latlngs, { color: 'red', opacity: 0.1 }).addTo(gsiMapMain)

  // チェック範囲の塩を描画
  L.circle([selectedGeometryPoint.latitude, selectedGeometryPoint.longitude], {
    color: 'blue', // 外周の色
    opacity: 0.3, // 外周の透明度
    fillColor: 'blue', // 円内部の色
    fillOpacity: 0.2, // デフォルトの透明度
    radius: 10, // 円の半径
    weight: 2 // 外周の幅を小さく設定
  }).addTo(gsiMapMain)
}

/**
 * ポリラインの更新
 */
const updateMap = (geometry: PointType[]) => {
  if (!gsiMap || !gsiMapContainer.value) return

  // gsiMapのポリラインとcircleを削除
  gsiMap.eachLayer((layer) => {
    if (!gsiMap) return
    if (layer instanceof L.Polyline || layer instanceof L.Circle) {
      gsiMap.removeLayer(layer)
    }
  })

  // polylineを描画
  const latlngs: L.LatLngTuple[] = geometry.map((point) => {
    return [point.latitude, point.longitude]
  })
  L.polyline(latlngs, { color: 'red', opacity: 0.5 }).addTo(gsiMap)

  gsiMap.fitBounds(L.polyline(latlngs).getBounds())
}

/**
 * マーカーの更新
 * @param point
 */
const updateMapMarker = (point: PointType) => {
  if (!gsiMap || !gsiMapContainer.value) return

  // マーカーを削除
  gsiMap.eachLayer((layer) => {
    if (!gsiMap) return
    if (layer instanceof L.Marker) {
      gsiMap.removeLayer(layer)
    }
  })

  // 特定の座標にマーカーを追加
  L.marker([point.latitude, point.longitude]).addTo(gsiMap)
}

// 一覧に表示するデータ
const points = computed(() => {
  // selectedGeometryとdata.valueをもとに生成
  return selectedGeometry.value.map((point) => {
    const check =
      locations.value?.some((location) => {
        if (
          location.point.coordinates[1] === point.latitude &&
          location.point.coordinates[0] === point.longitude
        ) {
          point.roadWidthType = location.road_width_type
          return true
        }
        return false
      }) ?? false

    return {
      check: check,
      label: check ? '済' : '未',
      latitude: point.latitude,
      longitude: point.longitude,
      roadWidthType: point.roadWidthType
    }
  })
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
        is_blind: false
      }
    })
  } else {
    // 新規
    await postLocations.mutateAsync({
      latitude: selectedGeometryPoint.value.latitude,
      longitude: selectedGeometryPoint.value.longitude,
      road_width_type: selectedRoadType.value,
      is_blind: false
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
  handleRoadTypeClick('TWO_LANE')
  e.preventDefault()
})
onKeyStroke(['x'], (e) => {
  handleRoadTypeClick('ONE_LANE_SPACIOUS')
  e.preventDefault()
})
onKeyStroke(['c'], (e) => {
  handleRoadTypeClick('ONE_LANE')
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

import L from 'leaflet'

const gsiMapMainContainer = ref(null)
const gsiMapContainer = ref(null)
let gsiMapMain: null | L.Map = null
let gsiMap: null | L.Map = null

const initMap = () => {
  if (!gsiMapContainer.value || !gsiMapMainContainer.value) return
  gsiMapMain = L.map(gsiMapMainContainer.value).setView([34.826114, 137.5715965], 18)
  L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', {
    attribution: "<a href='https://maps.gsi.go.jp/development/ichiran.html'>国土地理院</a>",
    maxZoom: 18
  }).addTo(gsiMapMain)

  gsiMap = L.map(gsiMapContainer.value).setView([34.826114, 137.5715965], 18)
  L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', {
    attribution: "<a href='https://maps.gsi.go.jp/development/ichiran.html'>国土地理院</a>",
    maxZoom: 18
  }).addTo(gsiMap)
}

onMounted(() => {
  initMap()
})

onBeforeUnmount(() => {
  if (gsiMap) {
    gsiMap.remove()
  }
})
</script>

<template>
  <div style="display: flex; width: 100%">
    <div style="flex: 7; height: 1000px">
      <div style="overflow: hidden; /* はみ出しを隠す */">
        <div
          ref="gsiMapMainContainer"
          style="
            flex: 5;
            background-color: gray;
            height: 1000px;
            transform: scale(1.2);
            /* z-index: -1; */
          "
        >
          gsi_map_main_area
        </div>
      </div>
      <div style="width: 100%">
        <div class="button-container">
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
    <div ref="gsiMapContainer" style="flex: 2; background-color: darkgray; height: 1000px">
      gsi_map_area
    </div>
    <div style="flex: 2; background-color: white">
      <table border="1" style="height: 1000px; overflow-y: auto; display: block">
        <thead>
          <tr style="background: lightblue">
            <th>DB</th>
            <th>地理座標</th>
            <th>路面状態</th>
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
            <td>{{ point.roadWidthType }}</td>
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
