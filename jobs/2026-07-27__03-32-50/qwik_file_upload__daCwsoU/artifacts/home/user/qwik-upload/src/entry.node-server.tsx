/*
 * Production Node SSR server entry.
 * Build with `npm run build`, then start with `npm run serve` (listens on PORT, default 3000).
 */
import { createQwikCity } from '@builder.io/qwik-city/middleware/node';
import qwikCityPlan from '@qwik-city-plan';
import { manifest } from '@qwik-client-manifest';
import render from './entry.ssr';
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 3000);

const { router, notFound, staticFile } = createQwikCity({
  render,
  qwikCityPlan,
  manifest,
  checkOrigin: false,
});

const server = createServer();

server.on('request', (req, res) => {
  staticFile(req, res, () => {
    router(req, res, () => {
      notFound(req, res, () => {});
    });
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Node server listening on http://localhost:${PORT}`);
});
