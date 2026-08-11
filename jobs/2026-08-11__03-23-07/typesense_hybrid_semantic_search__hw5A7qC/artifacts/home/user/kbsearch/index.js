const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;
const HOST = '127.0.0.1';

// Read API Key
const apiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
const BASE_URL = 'http://127.0.0.1:8108';

// Load pre-computed query vectors
const queryVectorsPath = path.join(__dirname, 'data', 'query_vectors.json');
const queryVectors = JSON.parse(fs.readFileSync(queryVectorsPath, 'utf8'));

// Serve static files from 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Helper to make requests to Typesense
async function tsRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'X-TYPESENSE-API-KEY': apiKey,
    'Content-Type': 'application/json',
    ...options.headers
  };
  const response = await fetch(url, {
    ...options,
    headers
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Typesense request failed: ${response.status} - ${text}`);
  }
  return response.json();
}

// Function to wait for Typesense to be ready and initialize the collection
async function initTypesense() {
  const collectionName = 'knowledge_base';

  // 1. Wait for Typesense to be healthy
  console.log('Waiting for Typesense server to be ready...');
  for (let i = 0; i < 15; i++) {
    try {
      const response = await fetch(`${BASE_URL}/health`, {
        headers: { 'X-TYPESENSE-API-KEY': apiKey }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          console.log('Typesense is healthy and ready.');
          break;
        }
      }
    } catch (err) {
      // Ignore and retry
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 2. Delete existing collection if it exists
  try {
    await tsRequest(`/collections/${collectionName}`, { method: 'DELETE' });
    console.log(`Deleted existing collection '${collectionName}'.`);
  } catch (err) {
    console.log(`Collection '${collectionName}' did not exist or could not be deleted.`);
  }

  // 3. Create collection schema
  const schema = {
    name: collectionName,
    fields: [
      { name: 'id', type: 'string' },
      { name: 'title', type: 'string' },
      { name: 'body', type: 'string' },
      { name: 'embedding', type: 'float[]', num_dim: 8 }
    ]
  };

  console.log(`Creating collection '${collectionName}'...`);
  await tsRequest('/collections', {
    method: 'POST',
    body: JSON.stringify(schema)
  });
  console.log('Collection created.');

  // 4. Load and index documents
  const documentsPath = path.join(__dirname, 'data', 'documents.json');
  const documents = JSON.parse(fs.readFileSync(documentsPath, 'utf8'));

  console.log(`Indexing ${documents.length} documents...`);
  for (const doc of documents) {
    await tsRequest(`/collections/${collectionName}/documents`, {
      method: 'POST',
      body: JSON.stringify(doc)
    });
    console.log(`Indexed document ${doc.id}`);
  }
  console.log('Typesense initialization complete.');
}

// Search API Endpoint
app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q;
    const mode = req.query.mode;
    const alphaStr = req.query.alpha;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required.' });
    }
    if (!mode || !['keyword', 'semantic', 'hybrid'].includes(mode)) {
      return res.status(400).json({ error: 'Valid "mode" (keyword, semantic, hybrid) is required.' });
    }

    const alpha = alphaStr ? parseFloat(alphaStr) : 0.5;
    if (isNaN(alpha) || alpha < 0.0 || alpha > 1.0) {
      return res.status(400).json({ error: '"alpha" must be a float between 0.0 and 1.0.' });
    }

    const collectionName = 'knowledge_base';
    let searchParams = {};

    if (mode === 'keyword') {
      searchParams = {
        q: q,
        query_by: 'title,body'
      };
    } else if (mode === 'semantic' || mode === 'hybrid') {
      const qClean = q.trim().toLowerCase();
      const vector = queryVectors[qClean];
      if (!vector) {
        return res.status(400).json({ error: `Query vector not found for query: "${q}"` });
      }

      const vectorStr = vector.join(',');

      if (mode === 'semantic') {
        searchParams = {
          q: '*',
          vector_query: `embedding:([${vectorStr}],k:10)`
        };
      } else {
        // hybrid mode
        searchParams = {
          q: q,
          query_by: 'title,body',
          vector_query: `embedding:([${vectorStr}],k:10,alpha:${alpha})`
        };
      }
    }

    // Build URL with search parameters
    const url = new URL(`${BASE_URL}/collections/${collectionName}/documents/search`);
    for (const [key, val] of Object.entries(searchParams)) {
      url.searchParams.append(key, val);
    }

    const tsRes = await fetch(url.toString(), {
      headers: {
        'X-TYPESENSE-API-KEY': apiKey
      }
    });

    if (!tsRes.ok) {
      const errText = await tsRes.text();
      return res.status(500).json({ error: `Typesense search failed: ${errText}` });
    }

    const searchData = await tsRes.json();

    // Map hits to results
    const results = (searchData.hits || []).map(hit => {
      const doc = hit.document;
      let score = 0;

      if (mode === 'keyword') {
        score = hit.text_match || 0;
      } else if (mode === 'semantic') {
        // cosine similarity (1 - distance)
        score = 1.0 - (hit.vector_distance || 0);
      } else if (mode === 'hybrid') {
        score = hit.hybrid_search_info ? hit.hybrid_search_info.rank_fusion_score : 0;
      }

      return {
        id: doc.id,
        title: doc.title,
        score: score
      };
    });

    // Explicitly sort results descending by score
    results.sort((a, b) => b.score - a.score);

    return res.json({
      mode: mode,
      results: results
    });

  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Start Express Server after initializing Typesense
async function startServer() {
  await initTypesense();
  app.listen(PORT, HOST, () => {
    console.log(`Web server is running at http://${HOST}:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
