import type { Components } from '@/types/openapi'
import { ref, shallowReadonly, type Ref, type InjectionKey, computed } from 'vue'
import PaPa, { type ParseResult } from 'papaparse'

type Location = Components.Schemas.Location

export type RoadConditionType = {
  latitude: number
  longitude: number
  roadCondition: Location['roadCondition']
}

type UseHomeStateType = {
  loadGeometries: (value: any) => Promise<void>
  getGeometries: () => Readonly<Ref<RoadConditionType[][]>>
  getOriginalGeometris: () => Readonly<Ref<RoadConditionType[][]>>
  changeSelectedGeometry: (index: number) => void
  changeSelectedGeometryPoint: (index: number) => void
  selectedGeometryIndex: Readonly<Ref<number>>
  selectedGeometry: Readonly<Ref<RoadConditionType[]>>
  selectedGeometryPointIndex: Readonly<Ref<number>>
  selectedGeometryPoint: Readonly<Ref<RoadConditionType>>
}

const useHomeState = (): UseHomeStateType => {
  const originalGeometries: Ref<RoadConditionType[][]> = ref([[]])
  const geometries: Ref<RoadConditionType[][]> = ref([[]])
  const selectedGeometryIndex: Ref<number> = ref(0)
  const selectedGeometryPointIndex: Ref<number> = ref(0)

  const loadGeometries = async (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      PaPa.parse(file, {
        complete: (
          results: ParseResult<{
            geometry_list: string //[number, number][]
            geometry_check_list: string //[number, number][]
            highway: string
            length: string
          }>
        ) => {
          originalGeometries.value = results.data.map((geometry) => {
            const geometry_list = JSON.parse(geometry.geometry_list)
            return geometry_list.map((point: any) => {
              return {
                latitude: point[0],
                longitude: point[1],
                roadCondition: 'UNCONFIRMED'
              }
            })
          })
          geometries.value = results.data.map((geometry) => {
            const geometry_list = JSON.parse(geometry.geometry_check_list)
            return geometry_list.map((point: any) => {
              return {
                latitude: point[0],
                longitude: point[1],
                roadCondition: 'UNCONFIRMED'
              }
            })
          })
          selectedGeometryIndex.value = 0
          selectedGeometryPointIndex.value = 0
          resolve()
        },
        header: true,
        dynamicTyping: true,
        error: () => {
          alert('エラーが発生しました')
          reject()
        }
      })
    })
  }

  const getGeometries = (): Readonly<Ref<RoadConditionType[][]>> => {
    return shallowReadonly(geometries)
  }

  const getOriginalGeometris = (): Readonly<Ref<RoadConditionType[][]>> => {
    return shallowReadonly(originalGeometries)
  }

  const changeSelectedGeometry = (index: number) => {
    selectedGeometryIndex.value = index
  }

  const changeSelectedGeometryPoint = (index: number) => {
    selectedGeometryPointIndex.value = index
  }

  return {
    loadGeometries,
    getGeometries,
    getOriginalGeometris,
    changeSelectedGeometry,
    changeSelectedGeometryPoint,
    selectedGeometry: shallowReadonly(
      computed(() => geometries.value[selectedGeometryIndex.value])
    ),
    selectedGeometryIndex: shallowReadonly(selectedGeometryIndex),
    selectedGeometryPoint: shallowReadonly(
      computed(
        () => geometries.value[selectedGeometryIndex.value][selectedGeometryPointIndex.value]
      )
    ),
    selectedGeometryPointIndex: shallowReadonly(selectedGeometryPointIndex)
  }
}

const UseHomeStateKey: InjectionKey<UseHomeStateType> = Symbol('HomeStateType')
export { useHomeState, UseHomeStateKey, type UseHomeStateType }
