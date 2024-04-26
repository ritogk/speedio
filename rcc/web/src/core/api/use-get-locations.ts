import { UseApiClientKey, type UseApiClientType } from '@/core/api/api-client'
import { useQuery } from '@tanstack/vue-query'
import { GET_LOCATIONS } from './query-key'
import { inject } from 'vue'

export const useGetLocations = () => {
  const useApiClient = inject(UseApiClientKey) as UseApiClientType
  const client = useApiClient.getClient()
  return useQuery({
    queryKey: [GET_LOCATIONS],
    queryFn: () => client.LocationsController_findAll().then((res) => res.data),
    staleTime: Infinity,
    retry: false
  })
}
