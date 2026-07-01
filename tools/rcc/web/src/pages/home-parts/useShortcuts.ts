import { onKeyStroke } from '@vueuse/core'
import { ref, type Ref } from 'vue'
import {
  type RoadWidthType
} from '@/pages/home-parts/useCsv'

export type LaneWidth = 'NORMAL' | 'NARROW'
export type RoadMargin = 'LARGE' | 'MEDIUM' | 'NONE'

export const useShortcuts = (options: {
  handleCenterlineClick: (hasCenterLine: boolean, roadWidthType: RoadWidthType) => void,
  handleRoadTypeClick: (roadWidthType: RoadWidthType) => void,
  handleLaneWidthClick: (laneWidth: LaneWidth) => Promise<void>,
  handleRoadMarginClick: (roadMargin: RoadMargin) => Promise<void>,
  handleGeometryMove: (index: number) => void,
  handlePointMove: (index: number) => void,
  selectedGeometryPointIndex: Ref<number>,
  selectedGeometryIndex: Ref<number>,
  selectedGeometry: Ref<any[]>,
  selectedRoadType: Ref<any>,
  selectedBeforeRoadType: Ref<any>,
}) => {
  const {
    handleLaneWidthClick,
    handleRoadMarginClick,
    handleGeometryMove,
    handlePointMove,
    selectedGeometryPointIndex,
    selectedGeometryIndex,
    selectedGeometry,
    selectedRoadType,
    selectedBeforeRoadType
  } = options

  const pendingLaneWidth = ref<LaneWidth | null>(null)
  const pendingRoadMargin = ref<RoadMargin | null>(null)

  const advanceToNext = () => {
    if (selectedGeometryPointIndex.value + 2 >= selectedGeometry.value.length) {
      handleGeometryMove(selectedGeometryIndex.value + 1)
    } else {
      handlePointMove(selectedGeometryPointIndex.value + 1)
    }
    selectedBeforeRoadType.value = selectedRoadType.value
    selectedRoadType.value = 'ONE_LANE'
  }

  const resetPending = () => {
    pendingLaneWidth.value = null
    pendingRoadMargin.value = null
  }

  const tryCommit = () => {
    if (pendingLaneWidth.value && pendingRoadMargin.value) {
      resetPending()
      advanceToNext()
    }
  }

  // 左手: road_margin (即保存)
  onKeyStroke(['z'], (e) => {
    pendingRoadMargin.value = 'LARGE'
    handleRoadMarginClick('LARGE')
    tryCommit()
    e.preventDefault()
  })
  onKeyStroke(['x'], (e) => {
    pendingRoadMargin.value = 'MEDIUM'
    handleRoadMarginClick('MEDIUM')
    tryCommit()
    e.preventDefault()
  })
  onKeyStroke(['c'], (e) => {
    pendingRoadMargin.value = 'NONE'
    handleRoadMarginClick('NONE')
    tryCommit()
    e.preventDefault()
  })
  // 右手: lane_width (即保存)
  onKeyStroke(['m'], (e) => {
    pendingLaneWidth.value = 'NORMAL'
    handleLaneWidthClick('NORMAL')
    tryCommit()
    e.preventDefault()
  })
  onKeyStroke([','], (e) => {
    pendingLaneWidth.value = 'NARROW'
    handleLaneWidthClick('NARROW')
    tryCommit()
    e.preventDefault()
  })

  // \\キー: 進む
  onKeyStroke(['\\'], (e) => {
    resetPending()
    advanceToNext()
    e.preventDefault()
  })
  // /キー: 戻る
  onKeyStroke(['/'], (e) => {
    resetPending()
    if (selectedGeometryPointIndex.value === 0) {
      handleGeometryMove(selectedGeometryIndex.value - 1)
    } else {
      handlePointMove(selectedGeometryPointIndex.value - 1)
    }
    e.preventDefault()
  })
  // Endキー: 3つ進む
  onKeyStroke(['End'], (e) => {
    resetPending()
    if (selectedGeometryPointIndex.value + 3 >= selectedGeometry.value.length) {
      handleGeometryMove(selectedGeometryIndex.value + 3)
    } else {
      handlePointMove(selectedGeometryPointIndex.value + 3)
    }
    selectedBeforeRoadType.value = selectedRoadType.value
    selectedRoadType.value = 'ONE_LANE'
    e.preventDefault()
  })
  // ]キー: ジオメトリ移動（進む）
  onKeyStroke([']'], (e) => {
    resetPending()
    handleGeometryMove(selectedGeometryIndex.value + 1)
    e.preventDefault()
  })
  // :キー: ジオメトリ移動（戻る）
  onKeyStroke([':'], (e) => {
    resetPending()
    handleGeometryMove(selectedGeometryIndex.value - 1)
    e.preventDefault()
  })

  return { pendingLaneWidth, pendingRoadMargin }
}
