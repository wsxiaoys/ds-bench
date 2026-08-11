const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Read API key
let TYPESENSE_API_KEY;
try {
  TYPESENSE_API_KEY = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
} catch (err) {
  console.error('Error reading Typesense API key from /etc/typesense-api-key:', err);
  process.exit(1);
}

const headers = {
  'X-TYPESENSE-API-KEY': TYPESENSE_API_KEY,
  'Content-Type': 'application/json'
};

// In-memory locks for per-player score updates to ensure concurrency safety
const locks = new Map();

async function runLocked(playerId, fn) {
  const previous = locks.get(playerId) || Promise.resolve();
  let resolveNext;
  const nextPromise = new Promise(r => { resolveNext = r; });
  locks.set(playerId, nextPromise);
  
  try {
    await previous;
    return await fn();
  } finally {
    resolveNext();
    if (locks.get(playerId) === nextPromise) {
      locks.delete(playerId);
    }
  }
}

// Initialize Typesense collection and seed roster if not exists
async function initTypesense() {
  const checkUrl = 'http://127.0.0.1:8108/collections/leaderboard';
  let exists = false;
  
  try {
    const checkRes = await fetch(checkUrl, { headers });
    if (checkRes.status === 200) {
      exists = true;
      console.log('Collection "leaderboard" already exists.');
    }
  } catch (err) {
    console.warn('Could not check collection existence:', err.message);
  }
  
  if (!exists) {
    console.log('Creating collection "leaderboard"...');
    const createUrl = 'http://127.0.0.1:8108/collections';
    const schema = {
      name: 'leaderboard',
      fields: [
        { name: 'name', type: 'string', sort: true },
        { name: 'score', type: 'int32' }
      ]
    };
    
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(schema)
    });
    
    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(`Failed to create collection: ${createRes.status} ${text}`);
    }
    console.log('Collection "leaderboard" created successfully.');
    
    // Seed initial roster
    console.log('Seeding initial roster...');
    const playersPath = path.join(__dirname, 'players.json');
    let players = [];
    try {
      players = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
    } catch (err) {
      console.error('Failed to read players.json, using fallback roster:', err);
      players = [
        { player_id: 'p1', name: 'Alice', score: 100 },
        { player_id: 'p2', name: 'Bob', score: 100 },
        { player_id: 'p3', name: 'Carol', score: 90 },
        { player_id: 'p4', name: 'Dave', score: 80 },
        { player_id: 'p5', name: 'Eve', score: 70 }
      ];
    }
    
    for (const player of players) {
      const doc = {
        id: player.player_id,
        name: player.name,
        score: player.score
      };
      const docUrl = 'http://127.0.0.1:8108/collections/leaderboard/documents';
      const docRes = await fetch(docUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(doc)
      });
      if (!docRes.ok) {
        const text = await docRes.text();
        console.error(`Failed to seed player ${player.player_id}: ${docRes.status} ${text}`);
      } else {
        console.log(`Seeded player ${player.player_id} (${player.name})`);
      }
    }
  }
}

// GET /api/leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const searchUrl = 'http://127.0.0.1:8108/collections/leaderboard/documents/search?q=*&query_by=name&sort_by=score:desc,name:asc&per_page=250';
    const searchRes = await fetch(searchUrl, { headers });
    
    if (!searchRes.ok) {
      const text = await searchRes.text();
      throw new Error(`Failed to search leaderboard: ${searchRes.status} ${text}`);
    }
    
    const searchJson = await searchRes.json();
    const players = searchJson.hits.map((hit, index) => ({
      rank: index + 1,
      player_id: hit.document.id,
      name: hit.document.name,
      score: hit.document.score
    }));
    
    return res.status(200).json(players);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/score
app.post('/api/score', async (req, res) => {
  const { player_id, delta } = req.body || {};
  
  if (player_id === undefined || delta === undefined) {
    return res.status(400).json({ error: 'Missing player_id or delta' });
  }
  
  if (typeof player_id !== 'string' || !Number.isInteger(delta)) {
    return res.status(400).json({ error: 'player_id must be a string and delta must be an integer' });
  }
  
  try {
    const result = await runLocked(player_id, async () => {
      // 1. Fetch current player
      const docUrl = `http://127.0.0.1:8108/collections/leaderboard/documents/${encodeURIComponent(player_id)}`;
      const getRes = await fetch(docUrl, { headers });
      
      if (getRes.status === 404) {
        return { status: 404 };
      }
      
      if (!getRes.ok) {
        const text = await getRes.text();
        throw new Error(`Failed to fetch player: ${getRes.status} ${text}`);
      }
      
      const player = await getRes.json();
      const newScore = player.score + delta;
      
      // 2. Update player score
      const patchRes = await fetch(docUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ score: newScore })
      });
      
      if (!patchRes.ok) {
        const text = await patchRes.text();
        throw new Error(`Failed to update player score: ${patchRes.status} ${text}`);
      }
      
      const updatedPlayer = await patchRes.json();
      return {
        status: 200,
        data: {
          player_id: updatedPlayer.id,
          name: updatedPlayer.name,
          score: updatedPlayer.score
        }
      };
    });
    
    if (result.status === 404) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    return res.status(200).json(result.data);
    
  } catch (err) {
    console.error('Error updating score:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve frontend for GET /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function main() {
  await initTypesense();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
