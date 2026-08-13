import express from 'express';
import { defineHandler } from 'wasp/server/utils';
import { globalMiddlewareConfigForExpress } from '../../middleware/index.js';
import { apiNamespaceMiddleware as _waspapiNamespaceNamenamespaceMiddlewareConfigFn } from '../../../../../../src/middleware';
import { status as _waspstatusfn } from '../../../../../../src/apis';
import { echo as _waspechofn } from '../../../../../../src/apis';
import { echoMiddleware as _waspechomiddlewareConfigFn } from '../../../../../../src/middleware';
const idFn = x => x;
const _waspstatusmiddlewareConfigFn = idFn;
const router = express.Router();
router.use('/api', globalMiddlewareConfigForExpress(_waspapiNamespaceNamenamespaceMiddlewareConfigFn));
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