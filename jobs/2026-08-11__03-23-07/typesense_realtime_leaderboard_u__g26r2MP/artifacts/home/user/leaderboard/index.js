const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;

app.use(express.json());

// Read Typesense configuration
const TYPESENSE_API_KEY = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
const TYPESENSE_URL = 'http://127.0.0.1:8108';

// Simple task queue to serialize all score updates and prevent race conditions
class TaskQueue {
  constructor() {
    this.queue = Promise.resolve();
  }

  add(task) {
    const resultPromise = new Promise((resolve, reject) => {
      this.queue = this.queue.then(async () => {
        try {
          const res = await task();
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
    });
    return resultPromise;
  }
}

const updateQueue = new TaskQueue();

// Initialize Typesense collection and seed if not exists
async function initTypesense() {
  console.log('Checking if "leaderboard" collection exists in Typesense...');
  const checkRes = await fetch(`${TYPESENSE_URL}/collections/leaderboard`, {
    headers: { 'X-TYPESENSE-API-KEY': TYPESENSE_API_KEY }
  });

  if (checkRes.status === 404) {
    console.log('Collection "leaderboard" not found. Creating and seeding...');
    
    // Create collection with sortable "name" field
    const createRes = await fetch(`${TYPESENSE_URL}/collections`, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': TYPESENSE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'leaderboard',
        fields: [
          { name: 'name', type: 'string', sort: true },
          { name: 'score', type: 'int32' }
        ]
      })
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Failed to create collection: ${createRes.status} ${errText}`);
    }

    console.log('Collection created. Seeding initial roster from players.json...');
    const playersData = JSON.parse(fs.readFileSync(path.join(__dirname, 'players.json'), 'utf8'));

    for (const player of playersData) {
      const doc = {
        id: player.player_id,
        name: player.name,
        score: player.score
      };
      const docRes = await fetch(`${TYPESENSE_URL}/collections/leaderboard/documents`, {
        method: 'POST',
        headers: {
          'X-TYPESENSE-API-KEY': TYPESENSE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(doc)
      });
      if (!docRes.ok) {
        const errText = await docRes.text();
        throw new Error(`Failed to seed player ${player.player_id}: ${docRes.status} ${errText}`);
      }
    }
    console.log('Seeding completed successfully.');
  } else if (!checkRes.ok) {
    const errText = await checkRes.text();
    throw new Error(`Failed to check collection: ${checkRes.status} ${errText}`);
  } else {
    console.log('Collection "leaderboard" already exists.');
  }
}

// GET / — returns the leaderboard HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// GET /api/leaderboard — returns status 200 and a JSON array ordered from best to worst rank
app.get('/api/leaderboard', async (req, res) => {
  try {
    const searchRes = await fetch(`${TYPESENSE_URL}/collections/leaderboard/documents/search?q=*&query_by=name&sort_by=score:desc,name:asc&per_page=250`, {
      headers: { 'X-TYPESENSE-API-KEY': TYPESENSE_API_KEY }
    });

    if (!searchRes.ok) {
      throw new Error(`Typesense search failed: ${searchRes.statusText}`);
    }

    const searchData = await searchRes.json();
    const leaderboard = searchData.hits.map((hit, index) => ({
      rank: index + 1,
      player_id: hit.document.id,
      name: hit.document.name,
      score: hit.document.score
    }));

    res.status(200).json(leaderboard);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/score — accepts a JSON body {"player_id": string, "delta": integer}
app.post('/api/score', async (req, res) => {
  const { player_id, delta } = req.body;

  // Validation
  if (player_id === undefined || delta === undefined) {
    return res.status(400).json({ error: 'Missing player_id or delta' });
  }
  if (typeof player_id !== 'string') {
    return res.status(400).json({ error: 'player_id must be a string' });
  }
  if (typeof delta !== 'number' || !Number.isInteger(delta)) {
    return res.status(400).json({ error: 'delta must be an integer' });
  }

  // Queue the task to guarantee atomic additive updates under concurrency
  updateQueue.add(async () => {
    // 1. Fetch current player document
    const getRes = await fetch(`${TYPESENSE_URL}/collections/leaderboard/documents/${encodeURIComponent(player_id)}`, {
      headers: { 'X-TYPESENSE-API-KEY': TYPESENSE_API_KEY }
    });

    if (getRes.status === 404) {
      return { status: 404, data: { error: `Player ${player_id} not found` } };
    }
    if (!getRes.ok) {
      throw new Error(`Failed to fetch player ${player_id}: ${getRes.statusText}`);
    }

    const player = await getRes.json();
    const newScore = player.score + delta;

    // 2. Update player score in Typesense
    const patchRes = await fetch(`${TYPESENSE_URL}/collections/leaderboard/documents/${encodeURIComponent(player_id)}`, {
      method: 'PATCH',
      headers: {
        'X-TYPESENSE-API-KEY': TYPESENSE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ score: newScore })
    });

    if (!patchRes.ok) {
      throw new Error(`Failed to update player ${player_id}: ${patchRes.statusText}`);
    }

    const updated = await patchRes.json();
    return {
      status: 200,
      data: {
        player_id: updated.id,
        name: updated.name,
        score: updated.score
      }
    };
  })
  .then(result => {
    res.status(result.status).json(result.data);
  })
  .catch(err => {
    console.error('Error updating score:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
});

// Start server after initializing Typesense
async function start() {
  try {
    await initTypesense();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Web app listening on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start application:', err);
    process.exit(1);
  }
}

start();
