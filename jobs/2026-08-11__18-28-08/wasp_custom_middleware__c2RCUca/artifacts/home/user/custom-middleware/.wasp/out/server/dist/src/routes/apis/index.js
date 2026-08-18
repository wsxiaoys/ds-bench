import express from 'express';
import { defineHandler } from 'wasp/server/utils';
import { globalMiddlewareConfigForExpress } from '../../middleware/index.js';
import { apiNamespaceMiddleware as _waspapiNamespacenamespaceMiddlewareConfigFn } from '../../../../../../src/apis';
import { status as _waspstatusfn } from '../../../../../../src/apis';
import { echo as _waspechofn } from '../../../../../../src/apis';
import { echoMiddleware as _waspechomiddlewareConfigFn } from '../../../../../../src/apis';
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