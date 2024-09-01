import type { Components } from '@/types/openapi'
import { ref, shallowReadonly, type Ref, type InjectionKey, computed } from 'vue'
import PaPa, { type ParseResult } from 'papaparse'

type Location = Components.Schemas.Location
export type RoadWidthType = Location['road_width_type']

export type PointType = {
  latitude: number
  longitude: number
  roadWidthType: RoadWidthType
}

export type GeometryPointType = {
  latitude: number
  longitude: number
  roadWidthType: RoadWidthType
  initialChecked: boolean // dbから読み込まれた時点のチェック状態
}

type UseHomeStateType = {
  loadGeometries: (value: any) => Promise<void>
  changeSelectedGeometry: (index: number) => void
  changeSelectedGeometryPoint: (index: number) => void
  changeFilterGeometry: () => void
  isLoaded: Readonly<Ref<boolean>>
  originalGeometries: Readonly<Ref<PointType[][]>>
  geometries: Readonly<Ref<GeometryPointType[][]>>
  filteredGeometries: Readonly<Ref<GeometryPointType[][]>>
  selectedGeometryIndex: Readonly<Ref<number>>
  selectedGeometry: Readonly<Ref<PointType[]>>
  selectedGeometryPointIndex: Readonly<Ref<number>>
  selectedGeometryPoint: Readonly<Ref<PointType>>
}

const useHomeState = (): UseHomeStateType => {
  const isLoaded = ref(false)
  // 全coordsを含むgeometryの情報。オリジナルで基本は変更しない。
  const originalGeometries: Ref<PointType[][]> = ref([[]])
  // チェック座標の座標を含む情報.
  const geometries: Ref<GeometryPointType[][]> = ref([[]])
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
            locations: string
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
              // チェック済の情報をparse
              const locations = JSON.parse(geometry.locations.replace(/'/g, '"')) as {
                latitude: number
                longitude: number
                road_condition: string
              }[]
              const geometry_list = JSON.parse(geometry.geometry_check_list)
              return geometry_list.map((point: any) => {
                return {
                  latitude: point[0],
                  longitude: point[1],
                  roadCondition: 'UNCONFIRMED',
                  initialChecked: locations.some((x) => {
                    return x.latitude === point[0] && x.longitude === point[1]
                  })
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

  // ジオメトリーをフィルタリングするフラグ
  const isFilterGeometry = ref(false)
  const changeFilterGeometry = () => {
    isFilterGeometry.value = !isFilterGeometry.value
  }
  /**
   * チェック済の座標が80%以上のgeometryのみ表示させる用
   */
  const filteredGeometries = computed(() => {
    if (!isFilterGeometry.value) return geometries.value

    return geometries.value.filter((geometry) => {
      const checkedCnt = geometry.filter((point) => {
        return point.initialChecked
      }).length
      if (geometry.length === 0 || checkedCnt === 0) return true
      // チェック済の座標が80%以上の場合に表示させる
      return checkedCnt / geometry.length <= 0.8
    })
  })

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
    filteredGeometries: shallowReadonly(filteredGeometries),
    changeSelectedGeometry,
    changeSelectedGeometryPoint,
    changeFilterGeometry,
    selectedGeometry: shallowReadonly(
      computed(() => filteredGeometries.value[selectedGeometryIndex.value])
    ),
    selectedGeometryIndex: shallowReadonly(selectedGeometryIndex),
    selectedGeometryPoint: shallowReadonly(
      computed(
        () =>
          filteredGeometries.value[selectedGeometryIndex.value][selectedGeometryPointIndex.value]
      )
    ),
    selectedGeometryPointIndex: shallowReadonly(selectedGeometryPointIndex)
  }
}

const UseHomeStateKey: InjectionKey<UseHomeStateType> = Symbol('HomeStateType')
export { useHomeState, UseHomeStateKey, type UseHomeStateType }
