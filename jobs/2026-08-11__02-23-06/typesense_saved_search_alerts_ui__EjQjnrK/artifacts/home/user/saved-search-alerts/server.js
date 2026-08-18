const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Typesense configuration
const TYPESENSE_HOST = 'http://127.0.0.1:8108';
let TYPESENSE_API_KEY = '';

try {
  TYPESENSE_API_KEY = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
} catch (err) {
  console.error('Failed to read Typesense API key from /etc/typesense-api-key:', err);
  process.exit(1);
}

const DB_PATH = path.join(__dirname, 'db.json');

// Database helper functions
function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    return { savedSearches: [] };
  }
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading DB, resetting:', err);
    return { savedSearches: [] };
  }
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function mapSavedSearch(search) {
  return {
    id: search.id,
    name: search.name,
    q: search.q,
    category: search.category,
    max_price: search.max_price,
    match_count: search.match_count,
    new_count: search.new_count
  };
}

// Ensure Typesense collection exists and import baseline
async function ensureCollectionExists() {
  const url = `${TYPESENSE_HOST}/collections/products`;
  const response = await fetch(url, {
    headers: {
      'X-TYPESENSE-API-KEY': TYPESENSE_API_KEY
    }
  });

  if (response.status === 404) {
    console.log('Products collection not found. Creating collection...');
    const createUrl = `${TYPESENSE_HOST}/collections`;
    const schema = {
      name: 'products',
      fields: [
        { name: 'name', type: 'string' },
        { name: 'category', type: 'string', facet: true },
        { name: 'price', type: 'float' }
      ]
    };
    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': TYPESENSE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(schema)
    });
    if (!createResponse.ok) {
      const errText = await createResponse.text();
      throw new Error(`Failed to create products collection: ${errText}`);
    }
    console.log('Created products collection in Typesense');
  } else if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to check products collection: ${errText}`);
  } else {
    console.log('Products collection already exists');
  }
}

async function importBaseline() {
  const baselinePath = path.join(__dirname, 'data', 'baseline.json');
  if (!fs.existsSync(baselinePath)) {
    console.warn(`Baseline file not found at ${baselinePath}`);
    return;
  }
  const baselineData = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

  const jsonl = baselineData.map(doc => JSON.stringify(doc)).join('\n');
  const importUrl = `${TYPESENSE_HOST}/collections/products/documents/import?action=upsert`;

  const response = await fetch(importUrl, {
    method: 'POST',
    headers: {
      'X-TYPESENSE-API-KEY': TYPESENSE_API_KEY,
      'Content-Type': 'text/plain'
    },
    body: jsonl
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to import baseline documents: ${errText}`);
  }
  console.log('Successfully imported baseline documents into Typesense');
}

// Helper to query Typesense and get all matching document IDs
async function getMatchSet(q, category, maxPrice) {
  const queryParams = new URLSearchParams();
  queryParams.set('q', q || '*');
  queryParams.set('query_by', 'name');

  const filters = [];
  if (category && category.trim() !== '') {
    filters.push(`category:=[${category.trim()}]`);
  }
  if (maxPrice !== null && maxPrice !== undefined) {
    filters.push(`price:<=${maxPrice}`);
  }
  if (filters.length > 0) {
    queryParams.set('filter_by', filters.join(' && '));
  }

  let page = 1;
  const perPage = 250;
  queryParams.set('per_page', perPage.toString());

  const allIds = [];

  while (true) {
    queryParams.set('page', page.toString());
    const url = `${TYPESENSE_HOST}/collections/products/documents/search?${queryParams.toString()}`;
    const response = await fetch(url, {
      headers: {
        'X-TYPESENSE-API-KEY': TYPESENSE_API_KEY
      }
    });
    if (!response.ok) {
      throw new Error(`Typesense search failed: ${response.statusText}`);
    }
    const data = await response.json();
    const hits = data.hits || [];
    for (const hit of hits) {
      if (hit.document && hit.document.id) {
        allIds.push(hit.document.id);
      }
    }
    if (allIds.length >= data.found || hits.length === 0) {
      break;
    }
    page++;
  }

  return allIds;
}

// Perform checking logic for a saved search
async function checkSavedSearch(search) {
  const currentIds = await getMatchSet(search.q, search.category, search.max_price);
  const matchCount = currentIds.length;
  let newCount = 0;

  if (search.last_checked_ids === null || search.last_checked_ids === undefined) {
    newCount = 0;
  } else {
    const previousSet = new Set(search.last_checked_ids);
    for (const id of currentIds) {
      if (!previousSet.has(id)) {
        newCount++;
      }
    }
  }

  search.match_count = matchCount;
  search.new_count = newCount;
  search.last_checked_ids = currentIds;

  return search;
}

// API Endpoints

// GET /api/ingest-catalog
app.get('/api/ingest-catalog', (req, res) => {
  try {
    const catalogPath = path.join(__dirname, 'data', 'catalog.json');
    if (!fs.existsSync(catalogPath)) {
      return res.status(404).json({ error: 'Catalog file not found' });
    }
    const catalogData = fs.readFileSync(catalogPath, 'utf8');
    res.json(JSON.parse(catalogData));
  } catch (err) {
    console.error('Error reading ingest catalog:', err);
    res.status(500).json({ error: 'Failed to read ingest catalog' });
  }
});

// POST /api/saved-searches
app.post('/api/saved-searches', (req, res) => {
  const { name, q, category, max_price } = req.body;

  if (typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Invalid name parameter' });
  }
  if (typeof q !== 'string') {
    return res.status(400).json({ error: 'Invalid q parameter' });
  }
  if (typeof category !== 'string') {
    return res.status(400).json({ error: 'Invalid category parameter' });
  }
  if (max_price !== null && typeof max_price !== 'number') {
    return res.status(400).json({ error: 'Invalid max_price parameter' });
  }

  const db = readDb();
  const newSearch = {
    id: crypto.randomUUID(),
    name: name.trim(),
    q: q,
    category: category.trim(),
    max_price: max_price,
    match_count: null,
    new_count: null,
    last_checked_ids: null
  };

  db.savedSearches.push(newSearch);
  writeDb(db);

  res.status(201).json(mapSavedSearch(newSearch));
});

// GET /api/saved-searches
app.get('/api/saved-searches', (req, res) => {
  const db = readDb();
  const mapped = db.savedSearches.map(mapSavedSearch);
  res.status(200).json(mapped);
});

// POST /api/saved-searches/{id}/check
app.post('/api/saved-searches/:id/check', async (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const searchIndex = db.savedSearches.findIndex(s => s.id === id);

  if (searchIndex === -1) {
    return res.status(404).json({ error: 'Saved search not found' });
  }

  try {
    const updatedSearch = await checkSavedSearch(db.savedSearches[searchIndex]);
    db.savedSearches[searchIndex] = updatedSearch;
    writeDb(db);
    res.status(200).json(mapSavedSearch(updatedSearch));
  } catch (err) {
    console.error(`Error checking saved search ${id}:`, err);
    res.status(500).json({ error: 'Failed to perform check' });
  }
});

// POST /api/check-all
app.post('/api/check-all', async (req, res) => {
  const db = readDb();
  const updatedSearches = [];

  try {
    for (let i = 0; i < db.savedSearches.length; i++) {
      const updated = await checkSavedSearch(db.savedSearches[i]);
      db.savedSearches[i] = updated;
      updatedSearches.push(mapSavedSearch(updated));
    }
    writeDb(db);
    res.status(200).json(updatedSearches);
  } catch (err) {
    console.error('Error checking all saved searches:', err);
    res.status(500).json({ error: 'Failed to perform check-all' });
  }
});

// POST /api/ingest
app.post('/api/ingest', async (req, res) => {
  const { documents } = req.body;

  if (!Array.isArray(documents)) {
    return res.status(400).json({ error: 'documents parameter must be an array' });
  }

  for (const doc of documents) {
    if (!doc || typeof doc.id !== 'string' || typeof doc.name !== 'string' || typeof doc.category !== 'string' || typeof doc.price !== 'number') {
      return res.status(400).json({ error: 'Invalid document structure' });
    }
  }

  if (documents.length === 0) {
    return res.status(200).json({ ingested: 0 });
  }

  try {
    const jsonl = documents.map(doc => JSON.stringify(doc)).join('\n');
    const importUrl = `${TYPESENSE_HOST}/collections/products/documents/import?action=upsert`;

    const response = await fetch(importUrl, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': TYPESENSE_API_KEY,
        'Content-Type': 'text/plain'
      },
      body: jsonl
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to ingest documents: ${errText}`);
    }

    const responseText = await response.text();
    const lines = responseText.trim().split('\n');
    let ingestedCount = 0;
    for (const line of lines) {
      if (line) {
        try {
          const resObj = JSON.parse(line);
          if (resObj.success) {
            ingestedCount++;
          }
        } catch (e) {
          // ignore parsing error
        }
      }
    }

    res.status(200).json({ ingested: ingestedCount });
  } catch (err) {
    console.error('Error during ingestion:', err);
    res.status(500).json({ error: 'Failed to ingest documents' });
  }
});

// Initialize server
async function startServer() {
  try {
    await ensureCollectionExists();
    await importBaseline();

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
