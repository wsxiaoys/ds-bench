const express = require('express');
const fs = require('fs');
const path = require('path');
const Typesense = require('typesense');
const { v4: uuidv4 } = require('uuid');

const TYPESENSE_API_KEY = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
const TYPESENSE_URL = 'http://127.0.0.1:8108';
const COLLECTION_NAME = 'products';
const BASELINE_PATH = path.join(__dirname, 'data', 'baseline.json');
const CATALOG_PATH = path.join(__dirname, 'data', 'catalog.json');
const SAVED_SEARCHES_PATH = path.join(__dirname, 'data', 'saved-searches.json');

const typesense = new Typesense.Client({
  nodes: [{ host: '127.0.0.1', port: 8108, protocol: 'http' }],
  apiKey: TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 5,
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Persistence helpers ---

function loadSavedSearches() {
  try {
    if (fs.existsSync(SAVED_SEARCHES_PATH)) {
      return JSON.parse(fs.readFileSync(SAVED_SEARCHES_PATH, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return [];
}

function saveSavedSearches(searches) {
  fs.writeFileSync(SAVED_SEARCHES_PATH, JSON.stringify(searches, null, 2));
}

// --- Typesense collection management ---

async function ensureCollection() {
  try {
    await typesense.collections(COLLECTION_NAME).retrieve();
  } catch (e) {
    // Collection doesn't exist, create it
    await typesense.collections().create({
      name: COLLECTION_NAME,
      fields: [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'category', type: 'string', facet: true },
        { name: 'price', type: 'float' },
      ],
    });
  }
}

async function indexBaseline() {
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  // Use upsert so re-running doesn't duplicate
  const result = await typesense
    .collections(COLLECTION_NAME)
    .documents()
    .import(baseline, { action: 'upsert' });

  // Wait for indexing to complete if there were items
  if (baseline.length > 0) {
    // Small delay to let Typesense process
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return baseline.length;
}

// --- Query helpers ---

async function getMatchSet(q, category, maxPrice) {
  // Build filter_by string
  const filters = [];
  if (category && category.trim() !== '') {
    filters.push(`category:=${category}`);
  }
  if (maxPrice !== null && maxPrice !== undefined) {
    filters.push(`price:<=${maxPrice}`);
  }

  const searchParams = {
    q: (q && q.trim() !== '' && q !== '*') ? q : '*',
    query_by: 'name',
    per_page: 250, // get all matches (we have small data sets)
    filter_by: filters.length > 0 ? filters.join(' && ') : undefined,
  };

  // Remove undefined keys
  Object.keys(searchParams).forEach(k => {
    if (searchParams[k] === undefined) delete searchParams[k];
  });

  const results = await typesense
    .collections(COLLECTION_NAME)
    .documents()
    .search(searchParams);

  // Collect all matching document IDs
  const matchIds = new Set();
  if (results.hits) {
    for (const hit of results.hits) {
      matchIds.add(hit.document.id);
    }
  }
  return matchIds;
}

function computeCounts(currentMatchSet, previousMatchSet) {
  const matchCount = currentMatchSet.size;
  let newCount = 0;

  if (previousMatchSet === null) {
    // First check: new_count = 0
    newCount = 0;
  } else {
    // Count ids in current that weren't in previous
    for (const id of currentMatchSet) {
      if (!previousMatchSet.has(id)) {
        newCount++;
      }
    }
  }

  return { matchCount, newCount };
}

// --- API Routes ---

// GET /api/catalog - list available catalog documents for ingest
app.get('/api/catalog', (req, res) => {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  res.json(catalog);
});

// POST /api/saved-searches
app.post('/api/saved-searches', (req, res) => {
  const { name, q, category, max_price } = req.body;

  const savedSearch = {
    id: uuidv4(),
    name: name || '',
    q: q || '',
    category: category || '',
    max_price: max_price !== undefined ? max_price : null,
    match_count: null,
    new_count: null,
    _previousMatchSet: null, // internal: array of ids from last check
  };

  const searches = loadSavedSearches();
  searches.push(savedSearch);
  saveSavedSearches(searches);

  // Return without internal fields
  const { _previousMatchSet, ...publicObj } = savedSearch;
  res.status(201).json(publicObj);
});

// GET /api/saved-searches
app.get('/api/saved-searches', (req, res) => {
  const searches = loadSavedSearches();
  const publicSearches = searches.map(s => {
    const { _previousMatchSet, ...publicObj } = s;
    return publicObj;
  });
  res.json(publicSearches);
});

// POST /api/saved-searches/:id/check
app.post('/api/saved-searches/:id/check', async (req, res) => {
  try {
    const searches = loadSavedSearches();
    const idx = searches.findIndex(s => s.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Saved search not found' });
    }

    const search = searches[idx];
    const previousMatchSet = search._previousMatchSet
      ? new Set(search._previousMatchSet)
      : null;

    const currentMatchSet = await getMatchSet(search.q, search.category, search.max_price);
    const { matchCount, newCount } = computeCounts(currentMatchSet, previousMatchSet);

    // Record current match set for next time
    search._previousMatchSet = Array.from(currentMatchSet);
    search.match_count = matchCount;
    search.new_count = newCount;

    saveSavedSearches(searches);

    const { _previousMatchSet, ...publicObj } = search;
    res.json(publicObj);
  } catch (err) {
    console.error('Check error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/check-all
app.post('/api/check-all', async (req, res) => {
  try {
    const searches = loadSavedSearches();
    const results = [];

    for (const search of searches) {
      const previousMatchSet = search._previousMatchSet
        ? new Set(search._previousMatchSet)
        : null;

      const currentMatchSet = await getMatchSet(search.q, search.category, search.max_price);
      const { matchCount, newCount } = computeCounts(currentMatchSet, previousMatchSet);

      search._previousMatchSet = Array.from(currentMatchSet);
      search.match_count = matchCount;
      search.new_count = newCount;

      const { _previousMatchSet, ...publicObj } = search;
      results.push(publicObj);
    }

    saveSavedSearches(searches);
    res.json(results);
  } catch (err) {
    console.error('Check-all error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ingest
app.post('/api/ingest', async (req, res) => {
  try {
    const { documents } = req.body;
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ error: 'No documents provided' });
    }

    await typesense
      .collections(COLLECTION_NAME)
      .documents()
      .import(documents, { action: 'upsert' });

    // Small delay to let Typesense process
    await new Promise(resolve => setTimeout(resolve, 300));

    res.json({ ingested: documents.length });
  } catch (err) {
    console.error('Ingest error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Startup ---

async function start() {
  await ensureCollection();
  await indexBaseline();

  app.listen(8080, () => {
    console.log('Server running on http://localhost:8080');
  });
}

start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
