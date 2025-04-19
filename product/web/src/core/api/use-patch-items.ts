import { UseApiClientKey, type UseApiClientType } from '@/core/api/api-client'
import type { Components } from '@/types/openapi'
import { GET_ITEMS } from '@/core/api/query-key'
import { inject } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'

export const usePatchItems = () => {
  const useApiClient = inject(UseApiClientKey) as UseApiClientType
  const client = useApiClient.getClient()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (params: { id: number; item: Components.Schemas.UpdateItemDto }) =>
      client.ItemsController_update(params.id, params.item),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [GET_ITEMS], exact: true })
    }
  })
  return mutation
}
