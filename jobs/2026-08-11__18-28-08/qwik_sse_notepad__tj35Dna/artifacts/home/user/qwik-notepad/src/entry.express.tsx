import { createQwikCity } from '@builder.io/qwik-city/middleware/node';
import qwikCityPlan from '@qwik-city-plan';
import { manifest } from '@qwik-client-manifest';
import render from './entry.ssr';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import compression from 'compression';

// Directory where the client assets are built
const distDir = fileURLToPath(new URL('../dist', import.meta.url));

// Create the Qwik City request handler
const { router, notFound, staticFile } = createQwikCity({
  render,
  qwikCityPlan,
  manifest,
  static: {
    root: distDir,
  },
});

const app = express();

// Enable compression
app.use(compression());

// Serve static files (client assets)
app.use(staticFile);

// Handle Qwik City routes
app.use(router);

// Handle 404
app.use(notFound);

// Start server on port 3000 (or from process.env.PORT)
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  /* eslint-disable-next-line no-console */
  console.log(`Server started: http://localhost:${PORT}/`);
});
