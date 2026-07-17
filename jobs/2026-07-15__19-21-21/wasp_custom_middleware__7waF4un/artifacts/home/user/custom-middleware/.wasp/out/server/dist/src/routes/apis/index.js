import express from 'express';
import { defineHandler } from 'wasp/server/utils';
import { globalMiddlewareConfigForExpress } from '../../middleware/index.js';
import { apiNamespaceMiddlewareFn as _waspapiNamespaceV1namespaceMiddlewareConfigFn } from '../../../../../../src/apis';
import { apiStatus as _waspapiStatusfn } from '../../../../../../src/apis';
import { apiEcho as _waspapiEchofn } from '../../../../../../src/apis';
import { apiEchoMiddlewareFn as _waspapiEchomiddlewareConfigFn } from '../../../../../../src/apis';
const idFn = x => x;
const _waspapiStatusmiddlewareConfigFn = idFn;
const router = express.Router();
router.use('/api', globalMiddlewareConfigForExpress(_waspapiNamespaceV1namespaceMiddlewareConfigFn));
const apiStatusMiddleware = globalMiddlewareConfigForExpress(_waspapiStatusmiddlewareConfigFn);
router.get('/api/status', apiStatusMiddleware, defineHandler((req, res) => {
    const context = {
        entities: {},
    };
    return _waspapiStatusfn(req, res, context);
}));
const apiEchoMiddleware = globalMiddlewareConfigForExpress(_waspapiEchomiddlewareConfigFn);
router.post('/api/echo', apiEchoMiddleware, defineHandler((req, res) => {
    const context = {
        entities: {},
    };
    return _waspapiEchofn(req, res, context);
}));
export default router;
//# sourceMappingURL=index.js.map