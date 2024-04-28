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

// import { AuthenticationApi } from "@/core/openapiClient"
// import { apiConfig } from "@/core/openapi"
// import { useQueryClient, useMutation } from "@tanstack/vue-query"
// import { GET_STATUS, GET_YOUTUBE_VIDEO, GET_COMPARISONS } from "./query-key"

// export const usePostAuthenticationLogout = () => {
//   const queryClient = useQueryClient()
//   const authenticationApi = new AuthenticationApi(apiConfig)

//   const mutation = useMutation({
//     mutationFn: () => authenticationApi.authenticationLogoutPost(),
//     onSuccess: async () => {
//       await queryClient.invalidateQueries({ queryKey: [GET_STATUS], exact: true })
//       await queryClient.resetQueries({
//         queryKey: [GET_YOUTUBE_VIDEO],
//         exact: true
//       })
//       await queryClient.resetQueries({
//         queryKey: [GET_COMPARISONS],
//         exact: true
//       })
//     }
//   })
//   return mutation
// }

// 呼び出し側
// const postUsers = usePostUsers()
// await postUsers.mutateAsync({
//   handleName: form.hanndleName.value.value,
//   carType: form.carType.value.value,
//   email: form.email.value.value,
//   password: form.password.value.value
// })
