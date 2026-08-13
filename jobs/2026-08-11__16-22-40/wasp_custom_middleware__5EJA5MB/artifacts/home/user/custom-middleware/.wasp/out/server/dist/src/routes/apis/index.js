import express from 'express';
import { defineHandler } from 'wasp/server/utils';
import { globalMiddlewareConfigForExpress } from '../../middleware/index.js';
import { apiNamespaceMiddlewareFn as _waspapiNamespacenamespaceMiddlewareConfigFn } from '../../../../../../src/middleware';
import { statusHandler as _waspstatusApifn } from '../../../../../../src/apis';
import { echoHandler as _waspechoApifn } from '../../../../../../src/apis';
import { echoMiddlewareFn as _waspechoApimiddlewareConfigFn } from '../../../../../../src/middleware';
const idFn = x => x;
const _waspstatusApimiddlewareConfigFn = idFn;
const router = express.Router();
router.use('/api', globalMiddlewareConfigForExpress(_waspapiNamespacenamespaceMiddlewareConfigFn));
const statusApiMiddleware = globalMiddlewareConfigForExpress(_waspstatusApimiddlewareConfigFn);
router.get('/api/status', statusApiMiddleware, defineHandler((req, res) => {
    const context = {
        entities: {},
    };
    return _waspstatusApifn(req, res, context);
}));
const echoApiMiddleware = globalMiddlewareConfigForExpress(_waspechoApimiddlewareConfigFn);
router.post('/api/echo', echoApiMiddleware, defineHandler((req, res) => {
    const context = {
        entities: {},
    };
    return _waspechoApifn(req, res, context);
}));
export default router;
//# sourceMappingURL=index.js.map