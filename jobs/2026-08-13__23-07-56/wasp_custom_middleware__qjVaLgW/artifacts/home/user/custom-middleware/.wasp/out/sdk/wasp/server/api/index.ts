
import { type ParamsDictionary as ExpressParams, type Query as ExpressQuery } from 'express-serve-static-core'

import {
  type Api,
} from '../_types'


// PUBLIC API
export type Status<
  P extends ExpressParams = ExpressParams,
  ResBody = any,
  ReqBody = any,
  ReqQuery extends ExpressQuery = ExpressQuery,
  Locals extends Record<string, any> = Record<string, any>
> =
  Api<
    [
    ],
    P,
    ResBody,
    ReqBody,
    ReqQuery,
    Locals
  >
export type Echo<
  P extends ExpressParams = ExpressParams,
  ResBody = any,
  ReqBody = any,
  ReqQuery extends ExpressQuery = ExpressQuery,
  Locals extends Record<string, any> = Record<string, any>
> =
  Api<
    [
    ],
    P,
    ResBody,
    ReqBody,
    ReqQuery,
    Locals
  >
