import OpenAPIClientAxios from 'openapi-client-axios'
import type { Client as ApiClient } from '@/types/openapi'
import { type InjectionKey } from 'vue'

type UseApiClientType = {
  setup: () => Promise<void>
  getClient: () => ApiClient
}

const useApiClient = (): UseApiClientType => {
  let client: ApiClient = {} as ApiClient
  const setup = async () => {
    const apiPrefix = import.meta.env.VITE_API_PREFIX
    const api = new OpenAPIClientAxios({
      definition: `/${apiPrefix}/public/openapi.yml`
    })
    await api.init()
    client = await api.getClient<ApiClient>()
    client.defaults.baseURL = apiPrefix
  }
  const getClient = (): ApiClient => {
    return client
  }
  return { setup, getClient }
}

const UseApiClientKey: InjectionKey<UseApiClientType> = Symbol('UseApiClientType')
export { useApiClient, UseApiClientKey, type UseApiClientType }
