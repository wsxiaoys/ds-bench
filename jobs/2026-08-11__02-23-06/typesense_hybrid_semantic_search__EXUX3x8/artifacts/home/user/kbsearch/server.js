const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;
const HOST = '127.0.0.1';

const TYPESENSE_HOST = 'http://127.0.0.1:8108';
const API_KEY = '7Cr22g6RGYrHcWHh9h0V8UoNzFNirvXr';

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Ensure Typesense is initialized on startup
async function ensureTypesenseInitialized() {
  console.log('Checking Typesense connection and initializing collection...');
  try {
    // 1. Check if collection exists
    const checkRes = await fetch(`${TYPESENSE_HOST}/collections/knowledge_base`, {
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });

    if (checkRes.ok) {
      console.log('Collection "knowledge_base" already exists. Re-initializing to ensure fresh data...');
      await fetch(`${TYPESENSE_HOST}/collections/knowledge_base`, {
        method: 'DELETE',
        headers: { 'X-TYPESENSE-API-KEY': API_KEY }
      });
    }

    // 2. Create collection
    const schema = {
      name: 'knowledge_base',
      fields: [
        { name: 'title', type: 'string' },
        { name: 'body', type: 'string' },
        { name: 'embedding', type: 'float[]', num_dim: 8 }
      ]
    };

    const createRes = await fetch(`${TYPESENSE_HOST}/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TYPESENSE-API-KEY': API_KEY
      },
      body: JSON.stringify(schema)
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Failed to create collection: ${errText}`);
    }

    console.log('Created collection "knowledge_base" successfully.');

    // 3. Load and import documents
    const docsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/documents.json'), 'utf8'));
    const ndjson = docsData.map(doc => JSON.stringify(doc)).join('\n');

    const importRes = await fetch(`${TYPESENSE_HOST}/collections/knowledge_base/documents/import?action=upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'X-TYPESENSE-API-KEY': API_KEY
      },
      body: ndjson
    });

    if (!importRes.ok) {
      const errText = await importRes.text();
      throw new Error(`Failed to import documents: ${errText}`);
    }

    console.log('Imported 8 documents into Typesense successfully.');
  } catch (err) {
    console.error('Typesense initialization failed:', err.message);
    process.exit(1);
  }
}

// API Search Endpoint
app.get('/api/search', async (req, res) => {
  try {
    const { q, mode, alpha } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required.' });
    }

    const searchMode = mode || 'keyword';

    if (!['keyword', 'semantic', 'hybrid'].includes(searchMode)) {
      return res.status(400).json({ error: 'Invalid search mode. Must be keyword, semantic, or hybrid.' });
    }

    // Load query vectors for semantic and hybrid modes
    let vector = null;
    if (searchMode === 'semantic' || searchMode === 'hybrid') {
      const queryVectors = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/query_vectors.json'), 'utf8'));
      vector = queryVectors[q];
      if (!vector) {
        return res.status(400).json({
          error: `Query vector not found for "${q}". Available pre-computed queries are: ${Object.keys(queryVectors).map(k => `"${k}"`).join(', ')}`
        });
      }
    }

    let typesenseUrl = '';
    let results = [];

    if (searchMode === 'keyword') {
      // Keyword mode
      typesenseUrl = `${TYPESENSE_HOST}/collections/knowledge_base/documents/search?q=${encodeURIComponent(q)}&query_by=title,body`;
      
      const tsRes = await fetch(typesenseUrl, {
        headers: { 'X-TYPESENSE-API-KEY': API_KEY }
      });

      if (!tsRes.ok) {
        const errText = await tsRes.text();
        throw new Error(`Typesense search failed: ${errText}`);
      }

      const tsJson = await tsRes.json();
      results = (tsJson.hits || []).map(hit => ({
        id: hit.document.id,
        title: hit.document.title,
        score: hit.text_match !== undefined ? Number(hit.text_match) : 0
      }));

    } else if (searchMode === 'semantic') {
      // Semantic mode
      const vectorStr = `[${vector.join(',')}]`;
      typesenseUrl = `${TYPESENSE_HOST}/collections/knowledge_base/documents/search?q=*&vector_query=embedding:(${vectorStr}, k:10)`;

      const tsRes = await fetch(typesenseUrl, {
        headers: { 'X-TYPESENSE-API-KEY': API_KEY }
      });

      if (!tsRes.ok) {
        const errText = await tsRes.text();
        throw new Error(`Typesense semantic search failed: ${errText}`);
      }

      const tsJson = await tsRes.json();
      results = (tsJson.hits || []).map(hit => ({
        id: hit.document.id,
        title: hit.document.title,
        score: hit.vector_distance !== undefined ? Number((1 - hit.vector_distance).toFixed(6)) : 0
      }));

    } else if (searchMode === 'hybrid') {
      // Hybrid mode
      const alphaVal = parseFloat(alpha !== undefined ? alpha : 0.5);
      if (isNaN(alphaVal) || alphaVal < 0 || alphaVal > 1) {
        return res.status(400).json({ error: 'Alpha parameter must be a float between 0.0 and 1.0.' });
      }

      const vectorStr = `[${vector.join(',')}]`;
      typesenseUrl = `${TYPESENSE_HOST}/collections/knowledge_base/documents/search?q=${encodeURIComponent(q)}&query_by=title,body&vector_query=embedding:(${vectorStr}, k:10, alpha:${alphaVal})`;

      const tsRes = await fetch(typesenseUrl, {
        headers: { 'X-TYPESENSE-API-KEY': API_KEY }
      });

      if (!tsRes.ok) {
        const errText = await tsRes.text();
        throw new Error(`Typesense hybrid search failed: ${errText}`);
      }

      const tsJson = await tsRes.json();
      results = (tsJson.hits || []).map(hit => ({
        id: hit.document.id,
        title: hit.document.title,
        score: hit.hybrid_search_info?.rank_fusion_score !== undefined ? Number(hit.hybrid_search_info.rank_fusion_score) : 0
      }));
    }

    return res.json({
      mode: searchMode,
      results: results
    });

  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
});

// Serve the index.html at GET /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
ensureTypesenseInitialized().then(() => {
  app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
  });
});
