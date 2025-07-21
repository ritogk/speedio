import { computed, ref, type Ref, watch } from 'vue'
import type { PointType } from '@/pages/home-parts/home-state'

export const usePointList = (
  selectedGeometry: Ref<PointType[]>,
  locations: Ref<any[] | undefined>,
  filteredGeometries: Ref<PointType[][]>,
  selectedGeometryIndex: Ref<number>
) => {
  // selectedGeometryPointIndexをusePointList内で管理
  const selectedGeometryPointIndex = ref(0)
  const changeSelectedGeometryPoint = (index: number) => {
    selectedGeometryPointIndex.value = index
  }
  const selectedGeometryPoint = computed(() => {
    return selectedGeometry.value[selectedGeometryPointIndex.value]
  })

  const points = computed(() => {
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
    return points.value[selectedGeometryPointIndex.value]
  }) 


  const selectedGeometryCheckCount = computed(() => {
    if (!locations.value) return 0
    const map =  new Map(
        locations.value.map(loc => [
        `${loc.point.coordinates[1]},${loc.point.coordinates[0]}`,
        true
        ])
    )
    return filteredGeometries.value[selectedGeometryIndex.value].filter(point =>
      map.has(`${point.latitude},${point.longitude}`)
    ).length
  })

  return {
    points,
    currentPoint,
    selectedGeometryCheckCount,
    selectedGeometryPointIndex,
    changeSelectedGeometryPoint,
    selectedGeometryPoint
  }
} 