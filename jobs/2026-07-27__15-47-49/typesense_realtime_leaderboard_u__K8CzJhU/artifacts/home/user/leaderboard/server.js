const express = require('express');
const Typesense = require('typesense');
const fs = require('fs');
const path = require('path');

const TYPESENSE_HOST = '127.0.0.1';
const TYPESENSE_PORT = 8108;
const TYPESENSE_PROTOCOL = 'http';
const TYPESENSE_API_KEY = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
const COLLECTION_NAME = 'leaderboard';
const PORT = 8080;

const app = express();
app.use(express.json());

// Typesense client
const typesense = new Typesense.Client({
  nodes: [{
    host: TYPESENSE_HOST,
    port: TYPESENSE_PORT,
    protocol: TYPESENSE_PROTOCOL,
  }],
  apiKey: TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 5,
});

// SSE clients
const sseClients = new Set();

// Per-player mutex: a map from player_id to a promise chain
const playerLocks = new Map();

// Acquire a lock for a player_id. Returns a release function.
function acquireLock(playerId) {
  return new Promise((resolve) => {
    const prev = playerLocks.get(playerId) || Promise.resolve();
    let release;
    const next = new Promise((r) => { release = r; });
    playerLocks.set(playerId, prev.then(() => {
      resolve(release);
      return next;
    }));
  });
}

// Collection schema
const collectionSchema = {
  name: COLLECTION_NAME,
  fields: [
    { name: 'name', type: 'string', sort: true },
    { name: 'score', type: 'int32', sort: true },
  ],
};

// Initial roster
const initialPlayers = [
  { player_id: 'p1', name: 'Alice', score: 100 },
  { player_id: 'p2', name: 'Bob', score: 100 },
  { player_id: 'p3', name: 'Carol', score: 90 },
  { player_id: 'p4', name: 'Dave', score: 80 },
  { player_id: 'p5', name: 'Eve', score: 70 },
];

async function setupCollection() {
  try {
    await typesense.collections(COLLECTION_NAME).retrieve();
    console.log('Collection already exists.');
  } catch (err) {
    if (err.httpStatus === 404) {
      console.log('Creating collection...');
      await typesense.collections().create(collectionSchema);
      console.log('Seeding initial data...');
      for (const player of initialPlayers) {
        await typesense.collections(COLLECTION_NAME).documents().create({
          id: player.player_id,
          name: player.name,
          score: player.score,
        });
      }
      console.log('Seeding complete.');
    } else {
      throw err;
    }
  }
}

// Get ranked leaderboard from Typesense
async function getLeaderboard() {
  const searchResult = await typesense.collections(COLLECTION_NAME).documents().search({
    q: '*',
    query_by: 'name',
    sort_by: 'score:desc,name:asc',
    per_page: 100,
  });

  const hits = searchResult.hits || [];
  return hits.map((hit, index) => ({
    rank: index + 1,
    player_id: hit.document.id,
    name: hit.document.name,
    score: hit.document.score,
  }));
}

// Notify all SSE clients that the leaderboard has changed
function notifyClients() {
  const data = 'event: update\ndata: refresh\n\n';
  for (const client of sseClients) {
    client.write(data);
  }
}

// SSE endpoint
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write('event: connected\ndata: {}\n\n');

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// GET /api/leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await getLeaderboard();
    res.json(leaderboard);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/score
app.post('/api/score', async (req, res) => {
  try {
    const { player_id, delta } = req.body;

    // Validate player_id
    if (player_id === undefined || player_id === null || typeof player_id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid player_id' });
    }

    // Validate delta
    if (delta === undefined || delta === null || !Number.isInteger(delta)) {
      return res.status(400).json({ error: 'Missing or invalid delta' });
    }

    // Acquire per-player lock to serialize updates for the same player
    const release = await acquireLock(player_id);

    try {
      // Retrieve current document
      let doc;
      try {
        doc = await typesense.collections(COLLECTION_NAME).documents(player_id).retrieve();
      } catch (err) {
        if (err.httpStatus === 404) {
          return res.status(404).json({ error: 'Player not found' });
        }
        throw err;
      }

      const newScore = doc.score + delta;

      // Update the score
      await typesense.collections(COLLECTION_NAME).documents(player_id).update({
        name: doc.name,
        score: newScore,
      });

      // Notify all SSE clients
      notifyClients();

      return res.json({
        player_id: player_id,
        name: doc.name,
        score: newScore,
      });
    } finally {
      release();
    }
  } catch (err) {
    console.error('Error updating score:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET / — serve the HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
async function start() {
  await setupCollection();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Leaderboard server listening on http://0.0.0.0:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
