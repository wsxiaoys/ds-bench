const http = require('http');
const fs = require('fs');
const path = require('path');

const API_KEY = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
const TYPESENSE_URL = 'http://127.0.0.1:8108';

// Read initial roster
const INITIAL_ROSTER_PATH = '/home/user/leaderboard/players.json';
const initialRoster = JSON.parse(fs.readFileSync(INITIAL_ROSTER_PATH, 'utf8'));

// Concurrency queues per player
const playerQueues = new Map();

function enqueueUpdate(playerId, updateFn) {
  const currentQueue = playerQueues.get(playerId) || Promise.resolve();
  const nextQueue = currentQueue.then(async () => {
    return await updateFn();
  });
  playerQueues.set(playerId, nextQueue.catch(() => {})); // prevent memory leaks
  return nextQueue;
}

// Initialize Typesense collection and seed if needed
async function initTypesense() {
  let connected = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${TYPESENSE_URL}/collections/leaderboard`, {
        headers: { 'X-TYPESENSE-API-KEY': API_KEY }
      });
      connected = true;
      if (res.status === 404) {
        console.log('Collection "leaderboard" not found. Creating and seeding...');
        const schema = {
          name: 'leaderboard',
          fields: [
            { name: 'name', type: 'string', sort: true },
            { name: 'score', type: 'int32' }
          ]
        };
        const createRes = await fetch(`${TYPESENSE_URL}/collections`, {
          method: 'POST',
          headers: {
            'X-TYPESENSE-API-KEY': API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(schema)
        });
        if (!createRes.ok) {
          throw new Error(`Failed to create collection: ${createRes.status}`);
        }
        
        // Seed with initial roster
        for (const p of initialRoster) {
          const doc = { id: p.player_id, name: p.name, score: p.score };
          const docRes = await fetch(`${TYPESENSE_URL}/collections/leaderboard/documents?action=upsert`, {
            method: 'POST',
            headers: {
              'X-TYPESENSE-API-KEY': API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(doc)
          });
          if (!docRes.ok) {
            throw new Error(`Failed to seed player ${p.player_id}: ${docRes.status}`);
          }
        }
        console.log('Collection created and seeded successfully.');
      } else if (res.ok) {
        console.log('Collection "leaderboard" already exists.');
      } else {
        throw new Error(`Failed to check collection: ${res.status}`);
      }
      break;
    } catch (err) {
      console.log('Waiting for Typesense server to be ready...', err.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  if (!connected) {
    console.error('Could not connect to Typesense server.');
    process.exit(1);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/') {
    fs.readFile(path.join(__dirname, 'index.html'), 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/leaderboard') {
    try {
      const searchRes = await fetch(`${TYPESENSE_URL}/collections/leaderboard/documents/search?q=*&query_by=name&sort_by=score:desc,name:asc&per_page=250`, {
        headers: { 'X-TYPESENSE-API-KEY': API_KEY }
      });
      if (!searchRes.ok) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch leaderboard from Typesense' }));
        return;
      }
      const searchData = await searchRes.json();
      const players = searchData.hits.map((hit, index) => ({
        rank: index + 1,
        player_id: hit.document.id,
        name: hit.document.name,
        score: hit.document.score
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(players));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/score') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      // Check if body is missing player_id, missing delta, or delta is not an integer
      if (!parsed || !parsed.hasOwnProperty('player_id') || !parsed.hasOwnProperty('delta')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing player_id or delta' }));
        return;
      }

      const { player_id, delta } = parsed;
      if (typeof player_id !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'player_id must be a string' }));
        return;
      }

      if (!Number.isInteger(delta)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'delta must be an integer' }));
        return;
      }

      // Enqueue the update to handle concurrency correctly
      enqueueUpdate(player_id, async () => {
        try {
          // 1. Fetch current score from Typesense
          const getRes = await fetch(`${TYPESENSE_URL}/collections/leaderboard/documents/${player_id}`, {
            headers: { 'X-TYPESENSE-API-KEY': API_KEY }
          });
          if (getRes.status === 404) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Player ID not found' }));
            return;
          }
          if (!getRes.ok) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to fetch player from Typesense' }));
            return;
          }
          const doc = await getRes.json();
          const newScore = doc.score + delta;

          // 2. Update player score in Typesense
          const updateRes = await fetch(`${TYPESENSE_URL}/collections/leaderboard/documents/${player_id}`, {
            method: 'PATCH',
            headers: {
              'X-TYPESENSE-API-KEY': API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ score: newScore })
          });
          if (!updateRes.ok) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to update player score in Typesense' }));
            return;
          }
          const updatedDoc = await updateRes.json();

          // 3. Return updated player
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            player_id: updatedDoc.id,
            name: updatedDoc.name,
            score: updatedDoc.score
          }));
        } catch (err) {
          console.error(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      });
    });
    return;
  }

  // 404 for other endpoints
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const PORT = 8080;
const HOST = '0.0.0.0';

initTypesense().then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
});
