import type {
  OpenAPIClient,
  Parameters,
  UnknownParamsObject,
  OperationResponse,
  AxiosRequestConfig,
} from 'openapi-client-axios';

declare namespace Components {
    namespace Schemas {
        export interface CreateItemDto {
            /**
             * テキスト
             */
            text: string;
        }
        export interface Item {
            /**
             * id
             */
            id: number;
            /**
             * テキスト
             */
            text: string;
            /**
             * 作成日時
             */
            created_at: string; // date-time
            /**
             * 更新日時
             */
            updated_at: string; // date-time
            /**
             * 削除日時
             */
            deletedAt: string; // date-time
        }
        export interface UpdateItemDto {
            /**
             * テキスト
             */
            text?: string;
        }
    }
}
declare namespace Paths {
    namespace ItemsControllerCreate {
        export type RequestBody = Components.Schemas.CreateItemDto;
        namespace Responses {
            export type $201 = Components.Schemas.Item;
        }
    }
    namespace ItemsControllerFindAll {
        namespace Parameters {
            export type MaxLatitude = number;
            export type MaxLongitude = number;
            export type MinLatitude = number;
            export type MinLongitude = number;
        }
        export interface QueryParameters {
            minLatitude?: Parameters.MinLatitude;
            minLongitude?: Parameters.MinLongitude;
            maxLatitude?: Parameters.MaxLatitude;
            maxLongitude?: Parameters.MaxLongitude;
        }
        namespace Responses {
            export type $200 = Components.Schemas.Item[];
        }
    }
    namespace ItemsControllerFindOne {
        namespace Parameters {
            export type Id = string;
        }
        export interface PathParameters {
            id: Parameters.Id;
        }
        namespace Responses {
            export type $200 = Components.Schemas.Item;
        }
    }
    namespace ItemsControllerRemove {
        namespace Parameters {
            export type Id = string;
        }
        export interface PathParameters {
            id: Parameters.Id;
        }
        namespace Responses {
            export interface $200 {
            }
        }
    }
    namespace ItemsControllerUpdate {
        namespace Parameters {
            export type Id = string;
        }
        export interface PathParameters {
            id: Parameters.Id;
        }
        export type RequestBody = Components.Schemas.UpdateItemDto;
        namespace Responses {
            export type $200 = Components.Schemas.Item;
        }
    }
}

export interface OperationMethods {
  /**
   * ItemsController_findAll - 位置情報の取得
   * 
   * バウンディングボックスを指定している場合はその範囲内の位置情報を取得。
   */
  'ItemsController_findAll'(
    parameters?: Parameters<Paths.ItemsControllerFindAll.QueryParameters> | null,
    data?: any,
    config?: AxiosRequestConfig  
  ): OperationResponse<Paths.ItemsControllerFindAll.Responses.$200>
  /**
   * ItemsController_create
   */
  'ItemsController_create'(
    parameters?: Parameters<UnknownParamsObject> | null,
    data?: Paths.ItemsControllerCreate.RequestBody,
    config?: AxiosRequestConfig  
  ): OperationResponse<Paths.ItemsControllerCreate.Responses.$201>
  /**
   * ItemsController_findOne
   */
  'ItemsController_findOne'(
    parameters?: Parameters<Paths.ItemsControllerFindOne.PathParameters> | null,
    data?: any,
    config?: AxiosRequestConfig  
  ): OperationResponse<Paths.ItemsControllerFindOne.Responses.$200>
  /**
   * ItemsController_update
   */
  'ItemsController_update'(
    parameters?: Parameters<Paths.ItemsControllerUpdate.PathParameters> | null,
    data?: Paths.ItemsControllerUpdate.RequestBody,
    config?: AxiosRequestConfig  
  ): OperationResponse<Paths.ItemsControllerUpdate.Responses.$200>
  /**
   * ItemsController_remove
   */
  'ItemsController_remove'(
    parameters?: Parameters<Paths.ItemsControllerRemove.PathParameters> | null,
    data?: any,
    config?: AxiosRequestConfig  
  ): OperationResponse<Paths.ItemsControllerRemove.Responses.$200>
}

export interface PathsDictionary {
  ['/items']: {
    /**
     * ItemsController_findAll - 位置情報の取得
     * 
     * バウンディングボックスを指定している場合はその範囲内の位置情報を取得。
     */
    'get'(
      parameters?: Parameters<Paths.ItemsControllerFindAll.QueryParameters> | null,
      data?: any,
      config?: AxiosRequestConfig  
    ): OperationResponse<Paths.ItemsControllerFindAll.Responses.$200>
    /**
     * ItemsController_create
     */
    'post'(
      parameters?: Parameters<UnknownParamsObject> | null,
      data?: Paths.ItemsControllerCreate.RequestBody,
      config?: AxiosRequestConfig  
    ): OperationResponse<Paths.ItemsControllerCreate.Responses.$201>
  }
  ['/items/{id}']: {
    /**
     * ItemsController_findOne
     */
    'get'(
      parameters?: Parameters<Paths.ItemsControllerFindOne.PathParameters> | null,
      data?: any,
      config?: AxiosRequestConfig  
    ): OperationResponse<Paths.ItemsControllerFindOne.Responses.$200>
    /**
     * ItemsController_update
     */
    'patch'(
      parameters?: Parameters<Paths.ItemsControllerUpdate.PathParameters> | null,
      data?: Paths.ItemsControllerUpdate.RequestBody,
      config?: AxiosRequestConfig  
    ): OperationResponse<Paths.ItemsControllerUpdate.Responses.$200>
    /**
     * ItemsController_remove
     */
    'delete'(
      parameters?: Parameters<Paths.ItemsControllerRemove.PathParameters> | null,
      data?: any,
      config?: AxiosRequestConfig  
    ): OperationResponse<Paths.ItemsControllerRemove.Responses.$200>
  }
}

export type Client = OpenAPIClient<OperationMethods, PathsDictionary>
