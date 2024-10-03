import { UseApiClientKey, type UseApiClientType } from '@/core/api/api-client'
import type { Components } from '@/types/openapi'
import { GET_LOCATIONS } from '@/core/api/query-key'
import { inject } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'

export const usePostLocations = () => {
  const useApiClient = inject(UseApiClientKey) as UseApiClientType
  const client = useApiClient.getClient()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: Components.Schemas.CreateLocationDto) =>
      // dataがなぜ任意?
      // client.LocationsController_create()
      client.LocationsController_create(null, data),
    onSuccess: async () => {
      // こいつ重そう・・・・単品で更新するようにしたほうがかるそう・・・・
      await queryClient.invalidateQueries({ queryKey: [GET_LOCATIONS], exact: true })
    }
  })
  return mutation
}
