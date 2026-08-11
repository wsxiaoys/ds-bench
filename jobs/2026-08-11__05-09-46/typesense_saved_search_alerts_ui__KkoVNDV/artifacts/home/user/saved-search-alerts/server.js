const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Typesense = require('typesense');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Load Typesense API key
const apiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();

// Initialize Typesense Client
const typesenseClient = new Typesense.Client({
  'nodes': [{
    'host': '127.0.0.1',
    'port': '8108',
    'protocol': 'http'
  }],
  'apiKey': apiKey,
  'connectionTimeoutSeconds': 5
});

const SAVED_SEARCHES_FILE = path.join(__dirname, 'data', 'saved_searches.json');

// Helper to load saved searches
function loadSavedSearches() {
  try {
    if (fs.existsSync(SAVED_SEARCHES_FILE)) {
      const data = fs.readFileSync(SAVED_SEARCHES_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading saved searches:', err);
  }
  return [];
}

// Helper to save saved searches
function saveSavedSearches(searches) {
  try {
    fs.writeFileSync(SAVED_SEARCHES_FILE, JSON.stringify(searches, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving saved searches:', err);
  }
}

// Helper to format saved search for public response (exactly the required keys)
function formatSavedSearch(search) {
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

// Helper to query Typesense for all matching document IDs
async function getAllMatchingIds(q, category, max_price) {
  const query = (q && q.trim() !== '') ? q : '*';
  const filters = [];
  if (category && category.trim() !== '') {
    filters.push(`category:=[${category}]`);
  }
  if (max_price !== null && max_price !== undefined) {
    filters.push(`price:<=${max_price}`);
  }
  const filter_by = filters.join(' && ');

  let page = 1;
  const perPage = 250;
  const ids = [];

  while (true) {
    const searchParams = {
      q: query,
      query_by: 'name',
      filter_by: filter_by || undefined,
      per_page: perPage,
      page: page
    };

    const res = await typesenseClient.collections('products').documents().search(searchParams);
    const pageIds = res.hits.map(hit => hit.document.id);
    ids.push(...pageIds);

    if (ids.length >= res.found || pageIds.length < perPage) {
      break;
    }
    page++;
  }

  return ids;
}

// Ensure products collection exists and baseline is indexed on startup
async function initTypesense() {
  try {
    // Check if collection exists
    let exists = true;
    try {
      await typesenseClient.collections('products').retrieve();
      console.log('Collection "products" already exists.');
    } catch (err) {
      exists = false;
    }

    if (!exists) {
      const schema = {
        name: 'products',
        fields: [
          { name: 'name', type: 'string' },
          { name: 'category', type: 'string', facet: true },
          { name: 'price', type: 'float' }
        ]
      };
      await typesenseClient.collections().create(schema);
      console.log('Created "products" collection.');
    }

    // Index baseline catalog
    const baselinePath = path.join(__dirname, 'data', 'baseline.json');
    if (fs.existsSync(baselinePath)) {
      const baselineDocs = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
      await typesenseClient.collections('products').documents().import(baselineDocs, { action: 'upsert' });
      console.log(`Indexed baseline catalog of ${baselineDocs.length} products.`);
    } else {
      console.warn('Baseline catalog file not found at', baselinePath);
    }
  } catch (err) {
    console.error('Error initializing Typesense:', err);
  }
}

// API Endpoints

// GET /api/catalog - Helper endpoint to get the ingest catalog for the UI
app.get('/api/catalog', (req, res) => {
  try {
    const catalogPath = path.join(__dirname, 'data', 'catalog.json');
    if (fs.existsSync(catalogPath)) {
      const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      res.json(catalog);
    } else {
      res.status(404).json({ error: 'Catalog file not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/saved-searches
app.get('/api/saved-searches', (req, res) => {
  const searches = loadSavedSearches();
  res.json(searches.map(formatSavedSearch));
});

// POST /api/saved-searches
app.post('/api/saved-searches', (req, res) => {
  const { name, q, category, max_price } = req.body;

  if (typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Name is required' });
  }

  const searches = loadSavedSearches();
  const id = 'ss_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

  const newSearch = {
    id,
    name,
    q: q || '',
    category: category || '',
    max_price: max_price === undefined ? null : max_price,
    match_count: null,
    new_count: null,
    last_checked_ids: null // internal field
  };

  searches.push(newSearch);
  saveSavedSearches(searches);

  res.status(201).json(formatSavedSearch(newSearch));
});

// POST /api/saved-searches/{id}/check
app.post('/api/saved-searches/:id/check', async (req, res) => {
  const { id } = req.params;
  const searches = loadSavedSearches();
  const searchIndex = searches.findIndex(s => s.id === id);

  if (searchIndex === -1) {
    return res.status(404).json({ error: 'Saved search not found' });
  }

  const search = searches[searchIndex];

  try {
    const currentIds = await getAllMatchingIds(search.q, search.category, search.max_price);
    const currentCount = currentIds.length;

    let newCount = 0;
    if (search.last_checked_ids === null || search.last_checked_ids === undefined) {
      newCount = 0;
    } else {
      const lastSet = new Set(search.last_checked_ids);
      for (const cid of currentIds) {
        if (!lastSet.has(cid)) {
          newCount++;
        }
      }
    }

    // Update state
    search.match_count = currentCount;
    search.new_count = newCount;
    search.last_checked_ids = currentIds;

    searches[searchIndex] = search;
    saveSavedSearches(searches);

    res.json(formatSavedSearch(search));
  } catch (err) {
    console.error('Error checking saved search:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/check-all
app.post('/api/check-all', async (req, res) => {
  const searches = loadSavedSearches();
  const updatedSearches = [];

  try {
    for (const search of searches) {
      const currentIds = await getAllMatchingIds(search.q, search.category, search.max_price);
      const currentCount = currentIds.length;

      let newCount = 0;
      if (search.last_checked_ids === null || search.last_checked_ids === undefined) {
        newCount = 0;
      } else {
        const lastSet = new Set(search.last_checked_ids);
        for (const cid of currentIds) {
          if (!lastSet.has(cid)) {
            newCount++;
          }
        }
      }

      search.match_count = currentCount;
      search.new_count = newCount;
      search.last_checked_ids = currentIds;

      updatedSearches.push(search);
    }

    saveSavedSearches(updatedSearches);
    res.json(updatedSearches.map(formatSavedSearch));
  } catch (err) {
    console.error('Error checking all saved searches:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ingest
app.post('/api/ingest', async (req, res) => {
  const { documents } = req.body;

  if (!Array.isArray(documents)) {
    return res.status(400).json({ error: 'documents must be an array' });
  }

  try {
    if (documents.length > 0) {
      await typesenseClient.collections('products').documents().import(documents, { action: 'upsert' });
    }
    res.json({ ingested: documents.length });
  } catch (err) {
    console.error('Error ingesting documents:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start server after initializing Typesense
async function start() {
  await initTypesense();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
