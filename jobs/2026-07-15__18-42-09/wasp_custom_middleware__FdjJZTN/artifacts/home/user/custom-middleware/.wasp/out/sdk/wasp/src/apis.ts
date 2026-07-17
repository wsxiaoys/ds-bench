import express from 'express';
import type { MiddlewareConfigFn } from 'wasp/server';

/**
 * Per-path (namespace) middleware applied to every api under `/api`.
 * Sets the `X-Api-Namespace: v1` response header.
 */
export const apiNamespaceMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  middlewareConfig.set('x-api-namespace-header', (_req, res, next) => {
    res.setHeader('X-Api-Namespace', 'v1');
    next();
  });
  return middlewareConfig;
};

/**
 * Per-api middleware applied only to `POST /api/echo`.
 *
 * - Replaces the default JSON body parser with a raw body parser, so the
 *   handler receives the unparsed request body as a Buffer on `req.body`.
 * - Adds a custom middleware that sets the `X-Echo: raw` response header.
 */
export const echoMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  middlewareConfig.delete('express.json');
  middlewareConfig.set('express.raw', express.raw({ type: '*/*' }));

  middlewareConfig.set('x-echo-header', (_req, res, next) => {
    res.setHeader('X-Echo', 'raw');
    next();
  });

  return middlewareConfig;
};

/**
 * GET /api/status -> { "status": "ok" }
 */
export const getStatus = (_req: any, res: any, _context: any) => {
  res.json({ status: 'ok' });
};

/**
 * POST /api/echo -> { "bytes": <byte length of raw request body> }
 *
 * Because the per-api middleware swapped the JSON parser for a raw parser,
 * `req.body` is a Buffer containing the unparsed request body.
 */
export const postEcho = (req: any, res: any, _context: any) => {
  const rawBody: Buffer | undefined = req.body;
  const bytes = rawBody ? rawBody.length : 0;
  res.json({ bytes });
};
