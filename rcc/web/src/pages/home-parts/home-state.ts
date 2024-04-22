import { type Components } from '@/types/openapi'
type Location = Components.Schemas.Location

type RoadConditionType = {
  latitude: number
  longitude: number
  roadCondition: Location['roadCondition']
}

type HomeStateType = {
  getLocations: () => Location[]
  setLocations: (value: Location[]) => void
  getRoadConditions: () => RoadConditionType[]
  setRoadConditions: (value: RoadConditionType[]) => void
  getCurrentRoadCondition: () => RoadConditionType
  setCurrentRoadCondition: (value: RoadConditionType) => void
}
