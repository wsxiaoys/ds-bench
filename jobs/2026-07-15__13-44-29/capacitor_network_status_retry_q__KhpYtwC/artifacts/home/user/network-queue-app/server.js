import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// In-memory data structures
let receivedLog = [];
let attemptCounts = {};

// POST /api/messages
app.post('/api/messages', (req, res) => {
  const { id, body, failTimes = 0 } = req.body;
  
  if (id === undefined || body === undefined) {
    return res.status(400).json({ error: 'id and body are required' });
  }

  // Increment attempt count for this id
  attemptCounts[id] = (attemptCounts[id] || 0) + 1;

  if (attemptCounts[id] <= failTimes) {
    return res.status(503).json({ status: 'error' });
  }

  // First attempt (and subsequent successful ones) after the threshold
  receivedLog.push({ id, body });
  return res.status(200).json({ status: 'ok', id });
});

// GET /api/received
app.get('/api/received', (req, res) => {
  res.status(200).json({ messages: receivedLog });
});

// POST /api/reset
app.post('/api/reset', (req, res) => {
  receivedLog = [];
  attemptCounts = {};
  res.status(200).json({ status: 'ok' });
});

// Serve built web app static assets
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for SPA routing if needed, serve index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
