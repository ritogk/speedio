import { onKeyStroke } from '@vueuse/core'
import type { Ref } from 'vue'
import {
  type RoadWidthType
} from '@/pages/home-parts/useCsv'

export const useShortcuts = (options: {
  handleCenterlineClick: (hasCenterLine: boolean, roadWidthType: RoadWidthType) => void,
  handleRoadTypeClick: (roadWidthType: RoadWidthType) => void,
  handleLineClearanceClick: (lineClearance: boolean) => void,
  handleGeometryMove: (index: number) => void,
  handlePointMove: (index: number) => void,
  selectedGeometryPointIndex: Ref<number>,
  selectedGeometryIndex: Ref<number>,
  selectedGeometry: Ref<any[]>,
  selectedRoadType: Ref<any>,
  selectedBeforeRoadType: Ref<any>,
}) => {
  const {
    handleLineClearanceClick,
    handleGeometryMove,
    handlePointMove,
    selectedGeometryPointIndex,
    selectedGeometryIndex,
    selectedGeometry,
    selectedRoadType,
    selectedBeforeRoadType
  } = options

  const advanceToNext = () => {
    if (selectedGeometryPointIndex.value + 2 >= selectedGeometry.value.length) {
      handleGeometryMove(selectedGeometryIndex.value + 1)
    } else {
      handlePointMove(selectedGeometryPointIndex.value + 1)
    }
    selectedBeforeRoadType.value = selectedRoadType.value
    selectedRoadType.value = 'ONE_LANE'
  }

  // \\キー: 進む（最後のポイントならジオメトリー切替）
  onKeyStroke(['\\'], (e) => {
    advanceToNext()
    e.preventDefault()
  })
  // /キー: 戻る（最初のポイントならジオメトリー切替）
  onKeyStroke(['/'], (e) => {
    if (selectedGeometryPointIndex.value === 0) {
      handleGeometryMove(selectedGeometryIndex.value - 1)
    } else {
      handlePointMove(selectedGeometryPointIndex.value - 1)
    }
    e.preventDefault()
  })
  // Endキー: 3つ進む
  onKeyStroke(['End'], (e) => {
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
    handleGeometryMove(selectedGeometryIndex.value + 1)
    e.preventDefault()
  })
  // :キー: ジオメトリ移動（戻る）
  onKeyStroke([':'], (e) => {
    handleGeometryMove(selectedGeometryIndex.value - 1)
    e.preventDefault()
  })
  // z/xキー: line_clearance入力 + 次へ進む
  onKeyStroke(['z'], (e) => {
    handleLineClearanceClick(true)
    advanceToNext()
    e.preventDefault()
  })
  onKeyStroke(['x'], (e) => {
    handleLineClearanceClick(false)
    advanceToNext()
    e.preventDefault()
  })
}
