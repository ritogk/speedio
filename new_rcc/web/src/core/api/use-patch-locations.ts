import { UseApiClientKey, type UseApiClientType } from '@/core/api/api-client'
import type { Components } from '@/types/openapi'
import { GET_LOCATIONS } from '@/core/api/query-key'
import { inject } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'

export const usePatchLocations = () => {
  const useApiClient = inject(UseApiClientKey) as UseApiClientType
  const client = useApiClient.getClient()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (params: { id: number; location: Components.Schemas.UpdateLocationDto }) =>
      client.LocationsController_update(params.id, params.location),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [GET_LOCATIONS], exact: true })
    }
  })
  return mutation
}
