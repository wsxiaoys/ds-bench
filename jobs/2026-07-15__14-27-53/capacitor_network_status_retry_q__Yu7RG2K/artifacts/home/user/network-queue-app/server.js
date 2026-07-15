// Single Node server that serves the built web app and the mock API.
//
// Both the SPA and the API live on the same origin (http://localhost:3000)
// so the browser does not need CORS to talk to the API.

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const DIST_DIR = path.join(__dirname, 'dist');

// Build the web app on demand if the dist directory is missing. This keeps
// `npm start` working both for fresh checkouts (no `dist/`) and for
// developers who already have a build.
if (!existsSync(DIST_DIR) || !existsSync(path.join(DIST_DIR, 'index.html'))) {
  console.log('[start] dist/ not found; running `npm run build`...');
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: __dirname,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error('[start] Build failed.');
    process.exit(result.status ?? 1);
  }
}

// --- API state ---------------------------------------------------------------

const state = {
  // Ordered log of successfully received messages. Appended on every
  // successful delivery; never de-duplicated server-side.
  received: [],
  // Attempts per id.
  attemptCount: new Map(),
};

function resetState() {
  state.received.length = 0;
  state.attemptCount.clear();
}

const app = express();
app.use(express.json());

// --- API routes --------------------------------------------------------------

app.post('/api/messages', (req, res) => {
  const { id, body, failTimes } = req.body || {};
  if (typeof id !== 'string' || typeof body !== 'string') {
    return res.status(400).json({ status: 'error', reason: 'bad-request' });
  }
  const f = typeof failTimes === 'number' && Number.isFinite(failTimes) ? failTimes : 0;

  // Count this attempt against the id (per-id, not per-id+body).
  const current = state.attemptCount.get(id) ?? 0;
  const next = current + 1;
  state.attemptCount.set(id, next);

  if (next <= f) {
    return res.status(503).json({ status: 'error' });
  }

  // First attempt past the threshold: record the message and acknowledge.
  state.received.push({ id, body });
  return res.status(200).json({ status: 'ok', id });
});

app.get('/api/received', (_req, res) => {
  return res.status(200).json({ messages: state.received.slice() });
});

app.post('/api/reset', (_req, res) => {
  resetState();
  return res.status(200).json({ status: 'ok' });
});

// --- Static SPA --------------------------------------------------------------

app.use(express.static(DIST_DIR, { index: 'index.html' }));

// SPA fallback: any non-API GET serves the app shell so client-side routing
// would work in a richer build. For this app we have a single page.
app.get(/^\/(?!api\/).*/, (_req, res, next) => {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!existsSync(indexPath)) {
    return next();
  }
  return res.sendFile(indexPath);
});

app.listen(PORT, () => {
  console.log(`[start] Serving web app and API on http://localhost:${PORT}`);
});
