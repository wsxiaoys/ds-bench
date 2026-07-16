import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

/* ------------------------------------------------------------------ */
/*  In-memory mock API state                                           */
/* ------------------------------------------------------------------ */

/** Ordered list of successfully-received messages. */
const receivedLog = [];

/** Per-id attempt counters (incremented on every POST to /api/messages). */
const attemptCounts = {};

/* ------------------------------------------------------------------ */
/*  Middleware                                                         */
/* ------------------------------------------------------------------ */

app.use(express.json());

/* ------------------------------------------------------------------ */
/*  API routes                                                         */
/* ------------------------------------------------------------------ */

// POST /api/messages
//   Body: { id: string, body: string, failTimes?: number }
//
//   The server counts attempts per `id`.  While the attempt count for
//   that `id` is <= `failTimes` it responds 503 and records nothing.
//   On the first attempt after that threshold it appends { id, body }
//   to the received log and responds 200.
app.post('/api/messages', (req, res) => {
  const { id, body } = req.body;
  const failTimes = typeof req.body.failTimes === 'number' ? req.body.failTimes : 0;

  if (typeof id !== 'string' || typeof body !== 'string') {
    return res.status(400).json({ status: 'error', message: 'id and body must be strings' });
  }

  // Increment the per-id attempt counter.
  attemptCounts[id] = (attemptCounts[id] || 0) + 1;
  const attempts = attemptCounts[id];

  if (attempts <= failTimes) {
    // Transient failure — respond 503, record nothing.
    return res.status(503).json({ status: 'error' });
  }

  // Success — append to the received log (no server-side de-duplication).
  receivedLog.push({ id, body });
  return res.status(200).json({ status: 'ok', id });
});

// GET /api/received
//   Returns the ordered list of successfully-received messages.
app.get('/api/received', (req, res) => {
  return res.status(200).json({ messages: receivedLog });
});

// POST /api/reset
//   Clears the received log and all per-id attempt counters.
app.post('/api/reset', (req, res) => {
  receivedLog.length = 0;
  for (const key of Object.keys(attemptCounts)) {
    delete attemptCounts[key];
  }
  return res.status(200).json({ status: 'ok' });
});

/* ------------------------------------------------------------------ */
/*  Static file serving (the built web app)                            */
/* ------------------------------------------------------------------ */

const distDir = join(__dirname, 'dist');

app.use(express.static(distDir));

// Fallback to index.html for any non-API route (SPA support).
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(join(distDir, 'index.html'));
});

/* ------------------------------------------------------------------ */
/*  Start                                                              */
/* ------------------------------------------------------------------ */

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});