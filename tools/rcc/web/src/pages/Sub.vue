<script setup lang="ts">
import { provide, computed, ref, onMounted } from 'vue'
import { Loader } from '@googlemaps/js-api-loader'
import { useHomeState, UseHomeStateKey, type RoadWidthType } from '@/pages/home-parts/useCsv'
import { useGetLocations } from '@/core/api/use-get-locations'
import { usePostLocations } from '@/core/api/use-post-locations'
import { usePatchLocations } from '@/core/api/use-patch-locations'

import { usePointList } from './home-parts/usePointList'
import { useShortcuts } from './home-parts/useShortcuts'
import { useGoogleMap } from './home-parts/useGoogleMap'
import { useGeometry } from './home-parts/useGeometry'
const apiKey = import.meta.env.VITE_API_KEY

// useGoogleMap composable を利用
const {
  map,
  polyline,
  panorama,
  initGoogleService,
  updateMap,
  updateMapMarker,
  updatePanorama,
  getCheckNextPoint,
  calculateHeading
} = useGoogleMap(apiKey)

onMounted(async () => {
  await initGoogleService([], { latitude: 0, longitude: 0, roadWidthType: 'ONE_LANE' })
  await loadFromUrl('/api/review/23')
  if (isLoaded.value) {
    await fetchAndApplyAllLocations()
    handleGeometryMove(0)
  }
})

const { data: locations, setQueryParams } = useGetLocations()
const postLocations = usePostLocations()
const patchLocations = usePatchLocations()

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

const geometryPointPageNoJump = ref(1)

const { loadGeometries, loadFromUrl, applyLocations, isLoaded, originalGeometries, geometries } = homeState

const {
  changeFilterGeometry,
  filterCriteria,
  filteredGeometries,
  selectedGeometryIndex,
  selectedGeometry,
  changeSelectedGeometry
} = useGeometry(geometries)

const fetchAndApplyAllLocations = async () => {
  const allPoints = originalGeometries.value.flat()
  if (allPoints.length === 0) return
  let minLat = allPoints[0].latitude, maxLat = allPoints[0].latitude
  let minLng = allPoints[0].longitude, maxLng = allPoints[0].longitude
  for (const p of allPoints) {
    if (p.latitude < minLat) minLat = p.latitude
    if (p.latitude > maxLat) maxLat = p.latitude
    if (p.longitude < minLng) minLng = p.longitude
    if (p.longitude > maxLng) maxLng = p.longitude
  }
  const res = await fetch(`/api/locations?minLatitude=${minLat}&maxLatitude=${maxLat}&minLongitude=${minLng}&maxLongitude=${maxLng}`)
  if (res.ok) {
    const locs = await res.json()
    applyLocations(locs)
  }
}

/**
 * csv読込
 * @param e
 */
const handleLoadCsv = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const fileList = target.files as FileList
  if (!fileList.length) return
  const file = target.files?.[0]
  await loadGeometries(file)
  await fetchAndApplyAllLocations()
  changeSelectedGeometry(0)
  changeSelectedGeometryPoint(0)

  const nextPoint = getCheckNextPoint(selectedGeometryPoint.value, originalGeometries.value)
  const heading = calculateHeading(selectedGeometryPoint.value, nextPoint)
  updatePanorama(selectedGeometryPoint.value, heading)
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
  const nextPoint = getCheckNextPoint(selectedGeometryPoint.value, originalGeometries.value)
  const heading = calculateHeading(selectedGeometryPoint.value, nextPoint)
  updatePanorama(selectedGeometryPoint.value, heading)
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
  console.log('handlePointMove', index)
  changeSelectedGeometryPoint(index)
  const nextPoint = getCheckNextPoint(selectedGeometryPoint.value, originalGeometries.value)
  const heading = calculateHeading(selectedGeometryPoint.value, nextPoint)
  updatePanorama(selectedGeometryPoint.value, heading)
  updateMapMarker(selectedGeometryPoint.value)
}

// pointlist関連のロジックをusePointListで取得
const {
  points,
  currentPoint,
  selectedGeometryCheckCount,
  selectedGeometryPointIndex,
  changeSelectedGeometryPoint,
  selectedGeometryPoint
} = usePointList(selectedGeometry, locations, filteredGeometries, selectedGeometryIndex)

const selectedRoadType = ref<RoadWidthType>('ONE_LANE')
const selectedBeforeRoadType = ref<RoadWidthType>('ONE_LANE')

const handleLaneWidthClick = async (laneWidth: string) => {
  if (!locations.value) return
  const location = locations.value.find((location) => {
    return (
      location.point.coordinates[1] === selectedGeometryPoint.value.latitude &&
      location.point.coordinates[0] === selectedGeometryPoint.value.longitude
    )
  })
  if (location) {
    await patchLocations.mutateAsync({
      id: location.id,
      location: { lane_width: laneWidth as any }
    })
  }
}

const handleRoadMarginClick = async (roadMargin: string) => {
  if (!locations.value) return
  const location = locations.value.find((location) => {
    return (
      location.point.coordinates[1] === selectedGeometryPoint.value.latitude &&
      location.point.coordinates[0] === selectedGeometryPoint.value.longitude
    )
  })
  if (location) {
    await patchLocations.mutateAsync({
      id: location.id,
      location: { road_margin: roadMargin as any }
    })
  }
}
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
 */
const handleCenterlineClick = async (hasCenterLine: boolean, roadWidthType: RoadWidthType) => {
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
        has_center_line: hasCenterLine,
        road_width_type: roadWidthType
      }
    })
  } else {
    // 新規
    await postLocations.mutateAsync({
      latitude: selectedGeometryPoint.value.latitude,
      longitude: selectedGeometryPoint.value.longitude,
      road_width_type: roadWidthType,
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

const { pendingLaneWidth, pendingRoadMargin } = useShortcuts({
  handleCenterlineClick,
  handleRoadTypeClick,
  handleLaneWidthClick,
  handleRoadMarginClick,
  handleGeometryMove,
  handlePointMove,
  selectedGeometryPointIndex,
  selectedGeometryIndex,
  selectedGeometry,
  selectedRoadType,
  selectedBeforeRoadType
})
</script>

<template>
  <div style="display: flex; width: 100%; height: 100vh; overflow: hidden">
    <div style="flex: 7; display: flex; flex-direction: column; height: 100vh">
      <div id="pano" style="flex: 1; background-color: gray">street_view_area</div>
      <div>
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
          <!-- センターライン -->
          <span>
            <button
              class="button-style"
              data-tooltip="center-lineあり"
              style="background: bisque"
              @click="handleCenterlineClick(true, 'TWO_LANE')"
            >
              <span v-show="selectedLocation?.has_center_line" style="color: red">★</span>
              yes
            </button>
            <button
              class="button-style"
              data-tooltip="center-lineなし"
              style="background: bisque"
              @click="handleCenterlineClick(false, 'ONE_LANE_SPACIOUS')"
            >
              <span v-show="!selectedLocation?.has_center_line" style="color: red">★</span>
              no(1
            </button>
            <button
              class="button-style"
              data-tooltip="center-lineなし"
              style="background: bisque"
              @click="handleCenterlineClick(false, 'ONE_LANE')"
            >
              <span v-show="!selectedLocation?.has_center_line" style="color: red">★</span>
              no(2
            </button>
          </span>
          <!-- 車線幅 (m/,) -->
          <span :style="{ background: pendingLaneWidth ? '#c8e6c9' : '', borderRadius: '4px', padding: '0 2px' }">
            <button class="button-style" data-tooltip="幅:普通(m)" @click="handleLaneWidthClick('NORMAL')">
              <span v-show="selectedLocation?.lane_width === 'NORMAL'" style="color: red">★</span>
              幅○
            </button>
            <button class="button-style" data-tooltip="幅:狭い(,)" @click="handleLaneWidthClick('NARROW')">
              <span v-show="selectedLocation?.lane_width === 'NARROW'" style="color: red">★</span>
              幅✕
            </button>
          </span>
          <!-- 余裕 (z/x/c) -->
          <span :style="{ background: pendingRoadMargin ? '#c8e6c9' : '', borderRadius: '4px', padding: '0 2px' }">
            <button class="button-style" data-tooltip="余裕:大(z)" @click="handleRoadMarginClick('LARGE')">
              <span v-show="selectedLocation?.road_margin === 'LARGE'" style="color: red">★</span>
              大
            </button>
            <button class="button-style" data-tooltip="余裕:中(x)" @click="handleRoadMarginClick('MEDIUM')">
              <span v-show="selectedLocation?.road_margin === 'MEDIUM'" style="color: red">★</span>
              中
            </button>
            <button class="button-style" data-tooltip="余裕:無(c)" @click="handleRoadMarginClick('NONE')">
              <span v-show="selectedLocation?.road_margin === 'NONE'" style="color: red">★</span>
              無
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
    <div id="map" style="flex: 2; background-color: darkgray; height: 100vh">google_map_area</div>
    <div style="flex: 1.5; background-color: white; display: flex; flex-direction: column; height: 100vh">
      <table border="1" style="flex: 1; overflow-y: auto; display: block; width: 100%">
        <thead>
          <tr style="background: lightblue">
            <th>DB</th>
            <th>地理座標</th>
            <th>路面状態</th>
            <th>ｾﾝﾀｰﾗｲﾝ</th>
            <th>幅</th>
            <th>余裕</th>
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
            <td style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ point.latitude.toFixed(4) }}, {{ point.longitude.toFixed(4) }}</td>
            <td
              :style="{
                backgroundColor: point.roadWidthType !== 'TWO_LANE' ? 'gray' : 'transparent',
                maxWidth: '60px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }"
            >
              {{ point.roadWidthType }}
            </td>
            <td>{{ point.hasCenterLine }}</td>
            <td :style="{ backgroundColor: index === selectedGeometryPointIndex ? (pendingLaneWidth ? '#c8e6c9' : '#ffe0b2') : '' }">{{ point.laneWidth }}</td>
            <td :style="{ backgroundColor: index === selectedGeometryPointIndex ? (pendingRoadMargin ? '#c8e6c9' : '#ffe0b2') : '' }">{{ point.roadMargin }}</td>
          </tr>
        </tbody>
      </table>
      <div class="control-panel">
        <div class="control-row">
          <button @click="handleGeometryMove(selectedGeometryIndex - 2)" :disabled="selectedGeometryIndex < 2 || isLoaded === false">◀◀</button>
          <button @click="handleGeometryMove(selectedGeometryIndex - 1)" :disabled="selectedGeometryIndex < 1 || isLoaded === false">◀</button>
          <button @click="handleGeometryMove(selectedGeometryIndex + 1)" :disabled="selectedGeometryIndex + 2 > filteredGeometries.length || isLoaded === false">▶</button>
          <button @click="handleGeometryMove(selectedGeometryIndex + 2)" :disabled="selectedGeometryIndex + 3 > filteredGeometries.length || isLoaded === false">▶▶</button>
          <span>{{ selectedGeometryIndex + 1 }}/{{ filteredGeometries.length }}</span>
          <input type="number" style="width: 40px; margin-left: 8px" v-model="geometryPointPageNoJump" />
          <button @click="handleGeometryMove(Number(geometryPointPageNoJump - 1))">go</button>
        </div>
        <div class="control-row filter-row">
          <button @click="handleChangeFilterGeometryClick()">filter</button>
          <label class="filter-label"><input type="checkbox" v-model="filterCriteria.roadWidthType" />道幅</label>
          <label class="filter-label"><input type="checkbox" v-model="filterCriteria.centerLine" />CL</label>
          <label class="filter-label"><input type="checkbox" v-model="filterCriteria.laneWidth" />幅</label>
          <label class="filter-label"><input type="checkbox" v-model="filterCriteria.roadMargin" />余裕</label>
          <input type="file" @change="handleLoadCsv" style="margin-left: auto; font-size: 11px; max-width: 140px" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.button-container .button-style {
  position: relative;
  width: 55px;
  height: 30px;
  margin: 2px;
  font-size: 12px;
  border: 1px solid #222;
  border-radius: 3px;
}
.button-container {
  text-align: center;
  padding: 2px 0;
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
  visibility: visible;
}
.control-panel {
  padding: 4px 6px;
  border-top: 1px solid #ddd;
  font-size: 12px;
}
.control-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
}
.filter-row {
  border-top: 1px solid #eee;
  padding-top: 4px;
}
.filter-label {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px;
  height: 22px;
  border: 1px solid #ccc;
  border-radius: 3px;
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
  line-height: 1;
}
.filter-label:has(input:checked) {
  background: #d0e8ff;
  border-color: #6aa8e0;
}
.filter-label input {
  margin: 0;
}
</style>
