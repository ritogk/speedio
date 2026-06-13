import { UseApiClientKey, type UseApiClientType } from '@/core/api/api-client'
import { useQuery } from '@tanstack/vue-query'
import { GET_LOCATIONS } from './query-key'
import { inject, ref } from 'vue'

import type { Paths } from '@/types/openapi'

export const useGetLocations = () => {
  const useApiClient = inject(UseApiClientKey) as UseApiClientType
  const client = useApiClient.getClient()
  const queryParams = ref<Paths.LocationsControllerFindAll.QueryParameters>({}) // リアクティブなクエリパラメーター
  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: [GET_LOCATIONS],
    queryFn: () => client.LocationsController_findAll(queryParams.value).then((res) => res.data),
    staleTime: 0, // キャッシュを無効化
    retry: false
  })

  const setQueryParams = (params: Paths.LocationsControllerFindAll.QueryParameters) => {
    queryParams.value = params
    refetch()
  }

  return { data, isError, isLoading, setQueryParams }
}
