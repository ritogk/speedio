import { UseApiClientKey, type UseApiClientType } from '@/core/api/api-client'
import { useQuery } from '@tanstack/vue-query'
import { GET_ITEMS } from './query-key'
import { inject, ref } from 'vue'

import type { Paths } from '@/types/openapi'

export const useGetItems = () => {
  const useApiClient = inject(UseApiClientKey) as UseApiClientType
  const client = useApiClient.getClient()
  const queryParams = ref<Paths.ItemsControllerFindAll.QueryParameters>({}) // リアクティブなクエリパラメーター
  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: [GET_ITEMS],
    queryFn: () => client.ItemsController_findAll(queryParams.value).then((res) => res.data),
    staleTime: 0, // キャッシュを無効化
    retry: false
  })

  const setQueryParams = (params: Paths.ItemsControllerFindAll.QueryParameters) => {
    queryParams.value = params
    refetch()
  }

  return { data, isError, isLoading, setQueryParams }
}
