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
  changeFilterGeometry: () => void
  isLoaded: Readonly<Ref<boolean>>
  originalGeometries: Readonly<Ref<PointType[][]>>
  geometries: Readonly<Ref<GeometryPointType[][]>>
  filteredGeometries: Readonly<Ref<GeometryPointType[][]>>
  selectedGeometryIndex: Readonly<Ref<number>>
  selectedGeometry: Readonly<Ref<PointType[]>>
  selectedGeometryPoint: Readonly<Ref<PointType>>
}

const useHomeState = (): UseHomeStateType => {
  const isLoaded = ref(false)
  // 全coordsを含むgeometryの情報。オリジナルで基本は変更しない。
  const originalGeometries: Ref<PointType[][]> = ref([[]])
  // チェック座標の座標を含む情報.
  const geometries: Ref<GeometryPointType[][]> = ref([[]])
  const selectedGeometryIndex: Ref<number> = ref(0)

  const loadGeometries = async (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      PaPa.parse(file, {
        complete: (
          results: ParseResult<{
            geometry_list: string //[number, number][]
            geometry_check_list: string //[number, number][]
            highway: string
            length: string
            locations_json: string
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
              const locations = JSON.parse(geometry.locations_json.replace(/'/g, '"')) as {
                latitude: number
                longitude: number
                road_condition: string
              }[]

              // ✨️geometry_check_listをlocationsにかえればいいのでは?
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
  const isFilterGeometry = ref(true)
  const changeFilterGeometry = () => {
    isFilterGeometry.value = !isFilterGeometry.value
  }
  /**
   * チェック済の座標が70%以上のgeometryのみ表示させる
   */
  const filteredGeometries = computed(() => {
    if (!isFilterGeometry.value) return geometries.value

    const filtered_geometry = geometries.value.filter((geometry) => {
      const checkedCnt = geometry.filter((point) => {
        return point.initialChecked
      }).length
      if (geometry.length === 0 || checkedCnt === 0) return true
      // console.log(
      //   `checkedCnt: ${checkedCnt}, geometry.length: ${geometry.length}, calc: ${checkedCnt / geometry.length}`
      // )

      // データが7個未満なら閾値を下げる
      let threshold = 0.6
      if (geometry.length <= 6) {
        threshold = 0.4
      } else if (geometry.length <= 8) {
        threshold = 0.5
      }
      // チェック済の座標が70%以上の場合に表示させる
      return checkedCnt / geometry.length <= threshold
    })
    if (filtered_geometry.length === 0) {
      alert('フィルタリングしたデータが0件です。フィルターを解除してください。')
    }
    return filtered_geometry
  })

  const changeSelectedGeometry = (index: number) => {
    selectedGeometryIndex.value = index
  }

  return {
    loadGeometries,
    isLoaded: shallowReadonly(isLoaded),
    originalGeometries: shallowReadonly(originalGeometries),
    geometries: shallowReadonly(geometries),
    filteredGeometries: shallowReadonly(filteredGeometries),
    changeSelectedGeometry,
    changeFilterGeometry,
    selectedGeometry: shallowReadonly(
      computed(() => filteredGeometries.value[selectedGeometryIndex.value])
    ),
    selectedGeometryIndex: shallowReadonly(selectedGeometryIndex),
    selectedGeometryPoint: shallowReadonly(
      computed(
        () =>
          filteredGeometries.value[selectedGeometryIndex.value][0]
      )
    )
  }
}

const UseHomeStateKey: InjectionKey<UseHomeStateType> = Symbol('HomeStateType')
export { useHomeState, UseHomeStateKey, type UseHomeStateType }
