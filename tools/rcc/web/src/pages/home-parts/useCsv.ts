import type { Components } from '@/types/openapi'
import { ref, shallowReadonly, type Ref, type InjectionKey } from 'vue'
import PaPa, { type ParseResult } from 'papaparse'

type Location = Components.Schemas.Location
export type RoadWidthType = Location['road_width_type']

export type PointType = {
  latitude: number
  longitude: number
  roadWidthType: RoadWidthType
}

export type CheckedFields = {
  roadWidthType: boolean
  centerLine: boolean
  wideLane: boolean
  shoulder: boolean
}

export type GeometryPointType = {
  latitude: number
  longitude: number
  roadWidthType: RoadWidthType
  initialChecked: boolean
  checkedFields: CheckedFields
}

type UseHomeStateType = {
  loadGeometries: (value: any) => Promise<void>
  loadFromUrl: (url: string) => Promise<void>
  applyLocations: (locations: Location[]) => void
  isLoaded: Readonly<Ref<boolean>>
  originalGeometries: Readonly<Ref<PointType[][]>>
  geometries: Readonly<Ref<GeometryPointType[][]>>
}

const useHomeState = (): UseHomeStateType => {
  const isLoaded = ref(false)
  const originalGeometries: Ref<PointType[][]> = ref([[]])
  const geometries: Ref<GeometryPointType[][]> = ref([[]])

  const parseGeometries = (
    results: ParseResult<{
      geometry_list: string
      geometry_check_list: string
      highway: string
      length: string
      locations_json: string
    }>
  ) => {
    originalGeometries.value = results.data
      .filter((geometry) => geometry.geometry_list !== undefined)
      .map((geometry) => {
        const geometry_list = JSON.parse(geometry.geometry_list)
        return geometry_list.map((point: any) => ({
          latitude: point[0],
          longitude: point[1],
          roadCondition: 'UNCONFIRMED'
        }))
      })

    geometries.value = results.data
      .filter((geometry) => geometry.geometry_check_list !== undefined)
      .map((geometry) => {
        const geometry_list = JSON.parse(geometry.geometry_check_list)
        return geometry_list.map((point: any) => ({
          latitude: point[0],
          longitude: point[1],
          roadCondition: 'UNCONFIRMED',
          initialChecked: false,
          checkedFields: {
            roadWidthType: false,
            centerLine: false,
            wideLane: false,
            shoulder: false,
          }
        }))
      })
    isLoaded.value = true
  }

  const applyLocations = (locations: Location[]) => {
    geometries.value = geometries.value.map((geometry) =>
      geometry.map((point) => {
        const loc = locations.find(
          (l) =>
            l.point.coordinates[1] === point.latitude &&
            l.point.coordinates[0] === point.longitude
        )
        if (!loc) return point
        return {
          ...point,
          initialChecked: true,
          checkedFields: {
            roadWidthType: !!loc.road_width_type && loc.road_width_type !== 'UNCONFIRMED',
            centerLine: loc.has_center_line !== null && loc.has_center_line !== undefined,
            wideLane: loc.has_wide_lane !== null && loc.has_wide_lane !== undefined,
            shoulder: loc.has_shoulder !== null && loc.has_shoulder !== undefined,
          }
        }
      })
    )
  }

  const loadFromUrl = async (url: string): Promise<void> => {
    const response = await fetch(url)
    if (!response.ok) return
    const text = await response.text()
    return new Promise((resolve, reject) => {
      PaPa.parse(text, {
        complete: (results: any) => {
          parseGeometries(results)
          resolve()
        },
        header: true,
        dynamicTyping: true,
        error: () => reject()
      })
    })
  }

  const loadGeometries = async (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      PaPa.parse(file, {
        complete: (results: any) => {
          parseGeometries(results)
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

  return {
    loadGeometries,
    loadFromUrl,
    applyLocations,
    isLoaded: shallowReadonly(isLoaded),
    originalGeometries: shallowReadonly(originalGeometries),
    geometries: shallowReadonly(geometries)
  }
}

const UseHomeStateKey: InjectionKey<UseHomeStateType> = Symbol('HomeStateType')
export { useHomeState, UseHomeStateKey, type UseHomeStateType }
