import { computed, ref, reactive, type Ref, shallowReadonly } from 'vue'
import type { PointType, GeometryPointType } from '@/pages/home-parts/useCsv'

export type FilterCriteria = {
  roadWidthType: boolean
  centerLine: boolean
  lineClearance: boolean
}

export const useGeometry = (
  geometries: Ref<GeometryPointType[][]>
) => {
  const isFilterGeometry = ref(true)
  const filterCriteria = reactive<FilterCriteria>({
    roadWidthType: true,
    centerLine: true,
    lineClearance: false,
  })
  const appliedCriteria = ref<FilterCriteria>({ ...filterCriteria })
  const filterVersion = ref(0)

  const changeFilterGeometry = () => {
    isFilterGeometry.value = !isFilterGeometry.value
    appliedCriteria.value = { ...filterCriteria }
    filterVersion.value++
  }

  const isPointChecked = (point: GeometryPointType, criteria: FilterCriteria): boolean => {
    if (!point.initialChecked) return false
    if (!criteria.roadWidthType && !criteria.centerLine && !criteria.lineClearance) return false
    const f = point.checkedFields
    if (criteria.roadWidthType && !f.roadWidthType) return false
    if (criteria.centerLine && !f.centerLine) return false
    if (criteria.lineClearance && !f.lineClearance) return false
    return true
  }

  const filteredGeometries = computed(() => {
    // filterVersionへの依存でボタン押下時のみ再計算
    void filterVersion.value
    if (!isFilterGeometry.value) return geometries.value
    const criteria = appliedCriteria.value
    const filtered_geometry = geometries.value.filter((geometry) => {
      const checkedCnt = geometry.filter((p) => isPointChecked(p, criteria)).length
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
    filterCriteria,
    filteredGeometries: shallowReadonly(filteredGeometries),
    selectedGeometryIndex: shallowReadonly(selectedGeometryIndex),
    selectedGeometry: shallowReadonly(selectedGeometry),
    changeSelectedGeometry
  }
}
