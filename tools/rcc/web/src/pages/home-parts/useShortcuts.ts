import { onKeyStroke } from '@vueuse/core'
import { ref, type Ref } from 'vue'
import {
  type RoadWidthType
} from '@/pages/home-parts/useCsv'

export type InputMode = 'lane' | 'shoulder'

export const useShortcuts = (options: {
  handleCenterlineClick: (hasCenterLine: boolean, roadWidthType: RoadWidthType) => void,
  handleRoadTypeClick: (roadWidthType: RoadWidthType) => void,
  handleWideLaneClick: (hasWideLane: boolean) => void,
  handleShoulderClick: (hasShoulder: boolean) => void,
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
    handleWideLaneClick,
    handleShoulderClick,
    handleGeometryMove,
    handlePointMove,
    selectedGeometryPointIndex,
    selectedGeometryIndex,
    selectedGeometry,
    selectedRoadType,
    selectedBeforeRoadType
  } = options

  const inputMode = ref<InputMode>('lane')

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
    inputMode.value = 'lane'
    e.preventDefault()
  })
  // /キー: 戻る（最初のポイントならジオメトリー切替）
  onKeyStroke(['/'], (e) => {
    if (selectedGeometryPointIndex.value === 0) {
      handleGeometryMove(selectedGeometryIndex.value - 1)
    } else {
      handlePointMove(selectedGeometryPointIndex.value - 1)
    }
    inputMode.value = 'lane'
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
    inputMode.value = 'lane'
    e.preventDefault()
  })
  // ]キー: ジオメトリ移動（進む）
  onKeyStroke([']'], (e) => {
    handleGeometryMove(selectedGeometryIndex.value + 1)
    inputMode.value = 'lane'
    e.preventDefault()
  })
  // :キー: ジオメトリ移動（戻る）
  onKeyStroke([':'], (e) => {
    handleGeometryMove(selectedGeometryIndex.value - 1)
    inputMode.value = 'lane'
    e.preventDefault()
  })
  // z/xキー: モードに応じて車線幅 or 路肩を入力
  onKeyStroke(['z'], (e) => {
    if (inputMode.value === 'lane') {
      handleWideLaneClick(true)
      inputMode.value = 'shoulder'
    } else {
      handleShoulderClick(true)
      advanceToNext()
      inputMode.value = 'lane'
    }
    e.preventDefault()
  })
  onKeyStroke(['x'], (e) => {
    if (inputMode.value === 'lane') {
      handleWideLaneClick(false)
      inputMode.value = 'shoulder'
    } else {
      handleShoulderClick(false)
      advanceToNext()
      inputMode.value = 'lane'
    }
    e.preventDefault()
  })

  return { inputMode }
}
