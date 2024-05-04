import type { Components } from '@/types/openapi'
import { ref, shallowReadonly, type Ref, type InjectionKey, computed } from 'vue'
import PaPa, { type ParseResult } from 'papaparse'

type Location = Components.Schemas.Location
export type RoadWidthType = Location['road_width_type']

export type PointType = {
  latitude: number
  longitude: number
  roadWidthType: RoadWidthType
  isBlind: boolean
}

type UseHomeStateType = {
  loadGeometries: (value: any) => Promise<void>
  changeSelectedGeometry: (index: number) => void
  changeSelectedGeometryPoint: (index: number) => void
  isLoaded: Readonly<Ref<boolean>>
  originalGeometries: Readonly<Ref<PointType[][]>>
  geometries: Readonly<Ref<PointType[][]>>
  selectedGeometryIndex: Readonly<Ref<number>>
  selectedGeometry: Readonly<Ref<PointType[]>>
  selectedGeometryPointIndex: Readonly<Ref<number>>
  selectedGeometryPoint: Readonly<Ref<PointType>>
}

const useHomeState = (): UseHomeStateType => {
  const isLoaded = ref(false)
  const originalGeometries: Ref<PointType[][]> = ref([[]])
  const geometries: Ref<PointType[][]> = ref([[]])
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
          originalGeometries.value = results.data
            .filter((geometry) => {
              // pythonで生成したcsvの末尾にundefindがはいってくるので除外
              if (geometry.geometry_list === undefined) return false
              return true
            })
            .map((geometry) => {
              const geometry_list = JSON.parse(geometry.geometry_list)
              return geometry_list.map((point: any) => {
                return {
                  latitude: point[0],
                  longitude: point[1],
                  roadCondition: 'UNCONFIRMED'
                }
              })
            })

          geometries.value = results.data
            .filter((geometry) => {
              // pythonで生成したcsvの末尾にundefindがはいってくるので除外
              if (geometry.geometry_check_list === undefined) return false
              return true
            })
            .map((geometry) => {
              const geometry_list = JSON.parse(geometry.geometry_check_list)
              return geometry_list.map((point: any) => {
                return {
                  latitude: point[0],
                  longitude: point[1],
                  roadCondition: 'UNCONFIRMED'
                }
              })
            })
          isLoaded.value = true
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

  const changeSelectedGeometry = (index: number) => {
    selectedGeometryIndex.value = index
  }

  const changeSelectedGeometryPoint = (index: number) => {
    selectedGeometryPointIndex.value = index
  }

  return {
    loadGeometries,
    isLoaded: shallowReadonly(isLoaded),
    originalGeometries: shallowReadonly(originalGeometries),
    geometries: shallowReadonly(geometries),
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
