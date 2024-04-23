import type { Components } from '@/types/openapi'
import { ref, shallowReadonly, type Ref } from 'vue'
import PaPa, { type ParseResult } from 'papaparse'

type Location = Components.Schemas.Location

type RoadConditionType = {
  latitude: number
  longitude: number
  roadCondition: Location['roadCondition']
}

type HomeStateType = {
  loadGeometries: (value: any) => void
  getGeometries: () => Readonly<Ref<RoadConditionType[][]>>
  changeSelectedGeometry: (value: [RoadConditionType]) => void
  getSelectedGeometry: () => Readonly<Ref<RoadConditionType[]>>
  changeSelectedGeometryPoint: (value: RoadConditionType) => void
  getSelectedGeometryPoint: () => Readonly<Ref<RoadConditionType>>
}

export const useHomeState = (): HomeStateType => {
  const geometries: Ref<RoadConditionType[][]> = ref([[]])
  const selectedGeometry: Ref<RoadConditionType[]> = ref([])
  const selectedGeometryPoint: Ref<RoadConditionType> = ref({
    latitude: 0,
    longitude: 0,
    roadCondition: 'ONE_LANE'
  })

  const loadGeometries = (file: File) => {
    PaPa.parse(file, {
      complete: (
        results: ParseResult<{
          geometry_list: string //[number, number][]
          highway: string
          length: string
        }>
      ) => {
        geometries.value = results.data.map((geometry) => {
          const geometry_list = JSON.parse(geometry.geometry_list)
          return geometry_list.map((point: any) => {
            return {
              latitude: point[0],
              longitude: point[1],
              roadCondition: 'UNCONFIRMED'
            }
          })
        })
        selectedGeometry.value = geometries.value[0]
        selectedGeometryPoint.value = selectedGeometry.value[0]
      },
      header: true,
      dynamicTyping: true,
      error: () => {
        alert('エラーが発生しました')
      }
    })
  }

  const getGeometries = (): Readonly<Ref<RoadConditionType[][]>> => {
    return shallowReadonly(geometries)
  }

  const changeSelectedGeometry = (value: [RoadConditionType]) => {
    selectedGeometry.value = value
  }

  const getSelectedGeometry = (): Readonly<Ref<RoadConditionType[]>> => {
    return shallowReadonly(selectedGeometry)
  }

  const changeSelectedGeometryPoint = (value: RoadConditionType) => {
    selectedGeometryPoint.value = value
  }

  const getSelectedGeometryPoint = (): Readonly<Ref<RoadConditionType>> => {
    return shallowReadonly(selectedGeometryPoint)
  }

  return {
    loadGeometries,
    getGeometries,
    changeSelectedGeometry,
    getSelectedGeometry,
    changeSelectedGeometryPoint,
    getSelectedGeometryPoint
  }
}
