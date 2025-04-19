import { UseApiClientKey, type UseApiClientType } from '@/core/api/api-client'
import type { Components } from '@/types/openapi'
import { GET_ITEMS } from '@/core/api/query-key'
import { inject } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'

export const usePostItems = () => {
  const useApiClient = inject(UseApiClientKey) as UseApiClientType
  const client = useApiClient.getClient()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: Components.Schemas.CreateItemDto) =>
      // dataがなぜ任意?
      // client.ItemsController_create()
      client.ItemsController_create(null, data),
    onSuccess: async () => {
      // こいつ重そう・・・・単品で更新するようにしたほうがかるそう・・・・
      await queryClient.invalidateQueries({ queryKey: [GET_ITEMS], exact: true })
    }
  })
  return mutation
}
