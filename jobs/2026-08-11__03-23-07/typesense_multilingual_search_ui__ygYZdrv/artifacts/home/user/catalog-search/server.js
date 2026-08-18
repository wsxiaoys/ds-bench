const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Read API key
let apiKey = '';
try {
  apiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
} catch (err) {
  console.error('Error reading Typesense API key from /etc/typesense-api-key:', err);
  process.exit(1);
}

// Read catalog data
let catalogData = [];
try {
  catalogData = JSON.parse(fs.readFileSync('/home/user/catalog-search/data/catalog.json', 'utf8'));
} catch (err) {
  console.error('Error reading catalog data from /home/user/catalog-search/data/catalog.json:', err);
  process.exit(1);
}

// Function to ensure collection exists and is indexed idempotently
async function ensureCollection() {
  const collectionName = 'catalog';
  const typesenseUrl = 'http://127.0.0.1:8108';

  console.log('Ensuring Typesense collection exists and is up to date...');

  try {
    // Check if collection exists
    const checkRes = await fetch(`${typesenseUrl}/collections/${collectionName}`, {
      headers: { 'X-TYPESENSE-API-KEY': apiKey }
    });

    if (checkRes.ok) {
      console.log(`Collection "${collectionName}" already exists. Deleting to recreate...`);
      const deleteRes = await fetch(`${typesenseUrl}/collections/${collectionName}`, {
        method: 'DELETE',
        headers: { 'X-TYPESENSE-API-KEY': apiKey }
      });
      if (!deleteRes.ok) {
        console.warn(`Warning: failed to delete collection "${collectionName}":`, await deleteRes.text());
      }
    }

    // Create collection schema
    const schema = {
      name: collectionName,
      fields: [
        { name: 'id', type: 'string' },
        { name: 'name_en', type: 'string', locale: 'en', stem: true },
        { name: 'name_fr', type: 'string', locale: 'fr', stem: true },
        { name: 'name_de', type: 'string', locale: 'de', stem: true }
      ]
    };

    console.log(`Creating collection "${collectionName}"...`);
    const createRes = await fetch(`${typesenseUrl}/collections`, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(schema)
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create collection: ${await createRes.text()}`);
    }
    console.log(`Collection "${collectionName}" created successfully.`);

    // Import documents
    console.log(`Indexing ${catalogData.length} documents...`);
    const jsonl = catalogData.map(doc => JSON.stringify(doc)).join('\n');
    const importRes = await fetch(`${typesenseUrl}/collections/${collectionName}/documents/import?action=create`, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: jsonl
    });

    if (!importRes.ok) {
      throw new Error(`Failed to import documents: ${await importRes.text()}`);
    }
    console.log('Indexing completed successfully.');

  } catch (err) {
    console.error('Error during Typesense initialization:', err);
    throw err;
  }
}

// Search endpoint
app.get('/api/search', async (req, res) => {
  const q = req.query.q || '';
  let lang = req.query.lang || 'en';
  if (lang !== 'en' && lang !== 'fr' && lang !== 'de') {
    lang = 'en';
  }

  if (!q || !q.trim()) {
    return res.json({ hits: [] });
  }

  try {
    const searchUrl = new URL('http://127.0.0.1:8108/collections/catalog/documents/search');
    searchUrl.searchParams.set('q', q);
    searchUrl.searchParams.set('query_by', `name_${lang}`);
    searchUrl.searchParams.set('prefix', 'false');
    searchUrl.searchParams.set('num_typos', '0');

    const searchRes = await fetch(searchUrl.toString(), {
      headers: { 'X-TYPESENSE-API-KEY': apiKey }
    });

    if (!searchRes.ok) {
      console.error('Typesense search error:', await searchRes.text());
      return res.status(500).json({ error: 'Search failed' });
    }

    const searchData = await searchRes.json();
    const hits = (searchData.hits || []).map(hit => {
      return {
        id: hit.document.id,
        name: hit.document[`name_${lang}`]
      };
    });

    return res.json({ hits });
  } catch (err) {
    console.error('Search endpoint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET / returns the HTML page (fallback if express.static doesn't handle it, although it will)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server after ensuring collection is initialized
async function start() {
  try {
    await ensureCollection();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
