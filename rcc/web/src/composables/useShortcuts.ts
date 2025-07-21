import { onKeyStroke } from '@vueuse/core'
import type { Ref } from 'vue'

export const useShortcuts = (options: {
  handleCenterlineClick: (hasCenterLine: boolean) => void,
  handleRoadTypeClick: (roadWidthType: any) => void,
  handleGeometryMove: (index: number) => void,
  handlePointMove: (index: number) => void,
  selectedGeometryPointIndex: Ref<number>,
  selectedGeometryIndex: Ref<number>,
  selectedGeometry: Ref<any[]>,
  selectedRoadType: Ref<any>,
  selectedBeforeRoadType: Ref<any>,
}) => {
  const {
    handleCenterlineClick,
    handleRoadTypeClick,
    handleGeometryMove,
    handlePointMove,
    selectedGeometryPointIndex,
    selectedGeometryIndex,
    selectedGeometry,
    selectedRoadType,
    selectedBeforeRoadType
  } = options

  // zキー: センターラインあり
  onKeyStroke(['z'], (e) => {
    handleCenterlineClick(true)
    e.preventDefault()
  })
  // xキー: センターラインなし
  onKeyStroke(['x'], (e) => {
    handleCenterlineClick(false)
    e.preventDefault()
  })
  // cキー: 予備（未使用）
  onKeyStroke(['c'], (e) => {
    e.preventDefault()
  })
  // \\キー: 進む（最後のポイントならジオメトリー切替）
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
  // /キー: 戻る（最初のポイントならジオメトリー切替）
  onKeyStroke(['/'], (e) => {
    // 最初のポイントの場合はジオメトリーを切り替える
    if (selectedGeometryPointIndex.value === 0) {
      handleGeometryMove(selectedGeometryIndex.value - 1)
    } else {
      handlePointMove(selectedGeometryPointIndex.value - 1)
    }
    e.preventDefault()
  })
  // Endキー: 3つ進む（最後のポイントならジオメトリー切替）
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
} 