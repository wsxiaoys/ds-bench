import express from 'express';
import { defineHandler } from 'wasp/server/utils';
import { globalMiddlewareConfigForExpress } from '../../middleware/index.js';
import { apiNamespaceMiddleware as _waspapiNamespacenamespaceMiddlewareConfigFn } from '../../../../../../src/server/middleware.js';
import { getStatus as _waspstatusfn } from '../../../../../../src/server/apis.js';
import { echoHandler as _waspechofn } from '../../../../../../src/server/apis.js';
import { echoMiddleware as _waspechomiddlewareConfigFn } from '../../../../../../src/server/apis.js';
const idFn = x => x;
const _waspstatusmiddlewareConfigFn = idFn;
const router = express.Router();
router.use('/api', globalMiddlewareConfigForExpress(_waspapiNamespacenamespaceMiddlewareConfigFn));
const statusMiddleware = globalMiddlewareConfigForExpress(_waspstatusmiddlewareConfigFn);
router.get('/api/status', statusMiddleware, defineHandler((req, res) => {
    const context = {
        entities: {},
    };
    return _waspstatusfn(req, res, context);
}));
const echoMiddleware = globalMiddlewareConfigForExpress(_waspechomiddlewareConfigFn);
router.post('/api/echo', echoMiddleware, defineHandler((req, res) => {
    const context = {
        entities: {},
    };
    return _waspechofn(req, res, context);
}));
export default router;
//# sourceMappingURL=index.js.map