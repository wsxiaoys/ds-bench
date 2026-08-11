import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8080;
const TYPESENSE_HOST = 'http://127.0.0.1:8108';
const API_KEY_PATH = '/etc/typesense-api-key';

let API_KEY = '';
try {
  API_KEY = fs.readFileSync(API_KEY_PATH, 'utf8').trim();
} catch (err) {
  console.error(`Failed to read API key from ${API_KEY_PATH}:`, err);
  process.exit(1);
}

const app = express();
app.use(express.json());

// Wait for Typesense to be ready
async function waitTypesense() {
  const healthUrl = `${TYPESENSE_HOST}/health`;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(healthUrl, {
        headers: { 'X-TYPESENSE-API-KEY': API_KEY }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          console.log('Typesense is healthy and ready!');
          return;
        }
      }
    } catch (err) {
      // ignore and retry
    }
    console.log(`Waiting for Typesense... (attempt ${i + 1}/20)`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.error('Typesense did not start in time.');
  process.exit(1);
}

// Initialize collection and seed if not present
async function initDatabase() {
  const getUrl = `${TYPESENSE_HOST}/collections/leaderboard`;
  try {
    const getRes = await fetch(getUrl, {
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });
    
    if (getRes.status === 404) {
      console.log('Leaderboard collection not found. Creating and seeding...');
      
      const schema = {
        name: 'leaderboard',
        fields: [
          { name: 'name', type: 'string', sort: true },
          { name: 'score', type: 'int32' }
        ]
      };
      
      const createRes = await fetch(`${TYPESENSE_HOST}/collections`, {
        method: 'POST',
        headers: {
          'X-TYPESENSE-API-KEY': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(schema)
      });
      
      if (!createRes.ok) {
        throw new Error(`Failed to create collection: ${createRes.status} ${await createRes.text()}`);
      }
      
      console.log('Collection created successfully. Seeding initial roster...');
      
      const players = [
        { id: 'p1', name: 'Alice', score: 100 },
        { id: 'p2', name: 'Bob', score: 100 },
        { id: 'p3', name: 'Carol', score: 90 },
        { id: 'p4', name: 'Dave', score: 80 },
        { id: 'p5', name: 'Eve', score: 70 }
      ];
      
      for (const player of players) {
        const seedRes = await fetch(`${TYPESENSE_HOST}/collections/leaderboard/documents`, {
          method: 'POST',
          headers: {
            'X-TYPESENSE-API-KEY': API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(player)
        });
        
        if (!seedRes.ok) {
          throw new Error(`Failed to seed player ${player.name}: ${seedRes.status} ${await seedRes.text()}`);
        }
      }
      
      console.log('Initial roster seeded successfully!');
    } else if (getRes.ok) {
      console.log('Leaderboard collection already exists.');
    } else {
      throw new Error(`Unexpected response when checking collection: ${getRes.status}`);
    }
  } catch (err) {
    console.error('Database initialization failed:', err);
    process.exit(1);
  }
}

// GET / - returns the leaderboard HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// GET /api/leaderboard - returns ordered players list
app.get('/api/leaderboard', async (req, res) => {
  try {
    const searchUrl = `${TYPESENSE_HOST}/collections/leaderboard/documents/search?q=*&query_by=name&sort_by=score:desc,name:asc&per_page=250`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });
    
    if (!searchRes.ok) {
      return res.status(500).json({ message: 'Failed to fetch leaderboard from Typesense' });
    }
    
    const searchJson = await searchRes.json();
    const hits = searchJson.hits || [];
    const documents = hits.map(hit => hit.document);
    
    // Sort in memory to strictly guarantee case-sensitive lexicographic tie-breaking order:
    // 1. score descending
    // 2. name ascending
    documents.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });
    
    const leaderboard = documents.map((doc, index) => ({
      rank: index + 1,
      player_id: doc.id,
      name: doc.name,
      score: doc.score
    }));
    
    res.status(200).json(leaderboard);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Concurrency queue per player
const playerQueues = new Map();

function enqueueUpdate(playerId, updateFn) {
  if (!playerQueues.has(playerId)) {
    playerQueues.set(playerId, Promise.resolve());
  }
  
  const currentPromise = playerQueues.get(playerId);
  const nextPromise = currentPromise.then(async () => {
    return await updateFn();
  });
  
  playerQueues.set(playerId, nextPromise.catch(() => {}));
  return nextPromise;
}

// POST /api/score - accepts signed delta and atomically updates score
app.post('/api/score', async (req, res) => {
  const { player_id, delta } = req.body;
  
  if (player_id === undefined || delta === undefined) {
    return res.status(400).json({ message: 'Missing player_id or delta' });
  }
  if (typeof player_id !== 'string') {
    return res.status(400).json({ message: 'player_id must be a string' });
  }
  if (!Number.isInteger(delta)) {
    return res.status(400).json({ message: 'delta must be an integer' });
  }
  
  try {
    const updatedPlayer = await enqueueUpdate(player_id, async () => {
      // 1. Fetch current document from Typesense
      const getUrl = `${TYPESENSE_HOST}/collections/leaderboard/documents/${player_id}`;
      const getRes = await fetch(getUrl, {
        headers: { 'X-TYPESENSE-API-KEY': API_KEY }
      });
      
      if (getRes.status === 404) {
        const error = new Error('Player not found');
        error.status = 404;
        throw error;
      }
      if (!getRes.ok) {
        const error = new Error(`Failed to fetch player: ${getRes.statusText}`);
        error.status = 500;
        throw error;
      }
      
      const playerDoc = await getRes.json();
      const newScore = playerDoc.score + delta;
      
      // 2. Update score in Typesense
      const patchUrl = `${TYPESENSE_HOST}/collections/leaderboard/documents/${player_id}`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          'X-TYPESENSE-API-KEY': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ score: newScore })
      });
      
      if (!patchRes.ok) {
        const error = new Error(`Failed to update score: ${patchRes.statusText}`);
        error.status = 500;
        throw error;
      }
      
      const updatedDoc = await patchRes.json();
      return {
        player_id: updatedDoc.id,
        name: updatedDoc.name,
        score: updatedDoc.score
      };
    });
    
    res.status(200).json(updatedPlayer);
  } catch (err) {
    console.error(`Error updating player ${player_id}:`, err);
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Internal server error' });
  }
});

// Start server
async function main() {
  await waitTypesense();
  await initDatabase();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web app listening on http://0.0.0.0:${PORT}`);
  });
}

main().catch(console.error);
