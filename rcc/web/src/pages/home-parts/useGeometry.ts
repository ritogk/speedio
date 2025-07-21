import { computed, ref, type Ref, shallowReadonly } from 'vue'
import type { PointType, GeometryPointType } from '@/pages/home-parts/useCsv'

export const useGeometry = (
  geometries: Ref<GeometryPointType[][]>
) => {
  const isFilterGeometry = ref(true)
  const changeFilterGeometry = () => {
    isFilterGeometry.value = !isFilterGeometry.value
  }

  /**
   * チェック済の座標が70%以上のgeometryのみ表示させる
   */
  const filteredGeometries = computed(() => {
    debugger
    if (!isFilterGeometry.value) return geometries.value
    const filtered_geometry = geometries.value.filter((geometry) => {
      const checkedCnt = geometry.filter((point) => {
        return point.initialChecked
      }).length
      if (geometry.length === 0 || checkedCnt === 0) return true
      let threshold = 0.6
      if (geometry.length <= 6) {
        threshold = 0.4
      } else if (geometry.length <= 8) {
        threshold = 0.5
      }
      return checkedCnt / geometry.length <= threshold
    })
    if (filtered_geometry.length === 0) {
      alert('フィルタリングしたデータが0件です。フィルターを解除してください。')
    }
    return filtered_geometry
  })
  const selectedGeometryIndex = ref(0)
  const selectedGeometry = computed(() => filteredGeometries.value[selectedGeometryIndex.value])
  const changeSelectedGeometry = (index: number) => {
    selectedGeometryIndex.value = index
  }
  return {
    isFilterGeometry: shallowReadonly(isFilterGeometry),
    changeFilterGeometry,
    filteredGeometries: shallowReadonly(filteredGeometries),
    selectedGeometryIndex: shallowReadonly(selectedGeometryIndex),
    selectedGeometry: shallowReadonly(selectedGeometry),
    changeSelectedGeometry
  }
} 