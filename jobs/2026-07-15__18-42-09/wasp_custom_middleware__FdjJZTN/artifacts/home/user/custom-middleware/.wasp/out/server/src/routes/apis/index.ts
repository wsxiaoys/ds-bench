import express from 'express'
import { prisma } from 'wasp/server'
import { defineHandler } from 'wasp/server/utils'
import { MiddlewareConfigFn, globalMiddlewareConfigForExpress } from '../../middleware/index.js'

import { apiNamespaceMiddlewareFn as _waspapiV1namespaceMiddlewareConfigFn } from '../../../../../../src/apis'

import { getStatus as _waspgetStatusfn } from '../../../../../../src/apis'
import { postEcho as _wasppostEchofn } from '../../../../../../src/apis'
import { echoMiddlewareFn as _wasppostEchomiddlewareConfigFn } from '../../../../../../src/apis'

const idFn: MiddlewareConfigFn = x => x

const _waspgetStatusmiddlewareConfigFn = idFn

const router = express.Router()

router.use('/api', globalMiddlewareConfigForExpress(_waspapiV1namespaceMiddlewareConfigFn))

const getStatusMiddleware = globalMiddlewareConfigForExpress(_waspgetStatusmiddlewareConfigFn)
router.get(
  '/api/status',
  getStatusMiddleware,
  defineHandler(
    (
      req: Parameters<typeof _waspgetStatusfn>[0],
      res: Parameters<typeof _waspgetStatusfn>[1],
    ) => {
      const context = {
        entities: {
        },
      }
      return _waspgetStatusfn(req, res, context)
    }
  )
)
const postEchoMiddleware = globalMiddlewareConfigForExpress(_wasppostEchomiddlewareConfigFn)
router.post(
  '/api/echo',
  postEchoMiddleware,
  defineHandler(
    (
      req: Parameters<typeof _wasppostEchofn>[0],
      res: Parameters<typeof _wasppostEchofn>[1],
    ) => {
      const context = {
        entities: {
        },
      }
      return _wasppostEchofn(req, res, context)
    }
  )
)

export default router
