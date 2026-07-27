const express = require('express');
const cors = require('cors');
const Typesense = require('typesense');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Typesense Client
const apiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
const client = new Typesense.Client({
  nodes: [
    {
      host: '127.0.0.1',
      port: '8108',
      protocol: 'http'
    }
  ],
  apiKey: apiKey,
  connectionTimeoutSeconds: 5
});

// Typesense Schema Definition
const schema = {
  name: 'products',
  fields: [
    { name: 'name', type: 'string' },
    { name: 'category', type: 'string', facet: true },
    { name: 'price', type: 'float' }
  ]
};

// Saved Searches Storage
const STORAGE_FILE = path.join(__dirname, 'data', 'saved_searches.json');

function loadSavedSearches() {
  if (fs.existsSync(STORAGE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
    } catch (e) {
      console.error('Error reading saved searches file, resetting to empty array', e);
      return [];
    }
  }
  return [];
}

function saveSavedSearches(searches) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(searches, null, 2), 'utf8');
}

// Helper to format saved search object for API response (exactly specific keys)
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

// Helper to query Typesense and get ALL matching document IDs
async function getAllMatchingIds(q, category, max_price) {
  const filterParts = [];
  if (category && category.trim() !== '') {
    filterParts.push(`category:=${category.trim()}`);
  }
  if (max_price !== null && max_price !== undefined && max_price !== '') {
    filterParts.push(`price:<= ${max_price}`);
  }

  let page = 1;
  const ids = [];
  while (true) {
    const searchParams = {
      q: q || '*',
      query_by: 'name',
      filter_by: filterParts.join(' && '),
      page: page,
      per_page: 250
    };
    const result = await client.collections('products').documents().search(searchParams);
    if (result.hits) {
      for (const hit of result.hits) {
        ids.push(hit.document.id);
      }
    }
    if (!result.hits || result.hits.length < 250 || ids.length >= result.found) {
      break;
    }
    page++;
  }
  return ids;
}

// Ensure products collection exists and baseline is indexed on startup
async function initTypesense() {
  try {
    try {
      await client.collections('products').retrieve();
      console.log('Collection "products" already exists.');
    } catch (err) {
      console.log('Collection "products" does not exist. Creating...');
      await client.collections().create(schema);
      console.log('Collection "products" created successfully.');
    }

    const baselinePath = path.join(__dirname, 'data', 'baseline.json');
    if (fs.existsSync(baselinePath)) {
      const baselineData = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
      console.log(`Indexing ${baselineData.length} baseline documents...`);
      const importResults = await client.collections('products').documents().import(baselineData, { action: 'upsert' });
      console.log('Baseline import completed.');
    } else {
      console.error('Baseline file not found at:', baselinePath);
    }
  } catch (err) {
    console.error('Error during Typesense initialization:', err);
    process.exit(1);
  }
}

// API Endpoints

// GET /api/saved-searches
app.get('/api/saved-searches', (req, res) => {
  try {
    const searches = loadSavedSearches();
    res.status(200).json(searches.map(formatSavedSearch));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/saved-searches
app.post('/api/saved-searches', (req, res) => {
  try {
    const { name, q, category, max_price } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'name is required and must be a non-empty string' });
    }

    const searches = loadSavedSearches();
    const newSearch = {
      id: crypto.randomUUID(),
      name: name.trim(),
      q: (q !== undefined && q !== null) ? String(q) : '',
      category: (category !== undefined && category !== null) ? String(category).trim() : '',
      max_price: (max_price === undefined || max_price === null || max_price === '') ? null : Number(max_price),
      match_count: null,
      new_count: null,
      previous_match_ids: null
    };

    searches.push(newSearch);
    saveSavedSearches(searches);

    res.status(201).json(formatSavedSearch(newSearch));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/saved-searches/{id}/check
app.post('/api/saved-searches/:id/check', async (req, res) => {
  try {
    const { id } = req.params;
    const searches = loadSavedSearches();
    const search = searches.find(s => s.id === id);
    if (!search) {
      return res.status(404).json({ error: `Saved search with ID ${id} not found` });
    }

    const currentIds = await getAllMatchingIds(search.q, search.category, search.max_price);
    const previousSet = new Set(search.previous_match_ids || []);
    
    let newCount = 0;
    if (search.previous_match_ids === null || search.previous_match_ids === undefined) {
      newCount = 0;
    } else {
      for (const docId of currentIds) {
        if (!previousSet.has(docId)) {
          newCount++;
        }
      }
    }

    search.match_count = currentIds.length;
    search.new_count = newCount;
    search.previous_match_ids = currentIds;

    saveSavedSearches(searches);

    res.status(200).json(formatSavedSearch(search));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/check-all
app.post('/api/check-all', async (req, res) => {
  try {
    const searches = loadSavedSearches();
    await Promise.all(searches.map(async (search) => {
      const currentIds = await getAllMatchingIds(search.q, search.category, search.max_price);
      const previousSet = new Set(search.previous_match_ids || []);
      
      let newCount = 0;
      if (search.previous_match_ids === null || search.previous_match_ids === undefined) {
        newCount = 0;
      } else {
        for (const docId of currentIds) {
          if (!previousSet.has(docId)) {
            newCount++;
          }
        }
      }

      search.match_count = currentIds.length;
      search.new_count = newCount;
      search.previous_match_ids = currentIds;
    }));

    saveSavedSearches(searches);

    res.status(200).json(searches.map(formatSavedSearch));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ingest
app.post('/api/ingest', async (req, res) => {
  try {
    const { documents } = req.body;
    if (!Array.isArray(documents)) {
      return res.status(400).json({ error: 'documents must be an array' });
    }
    if (documents.length === 0) {
      return res.status(200).json({ ingested: 0 });
    }

    const importResults = await client.collections('products').documents().import(documents, { action: 'upsert' });
    
    let ingestedCount = documents.length;
    if (typeof importResults === 'string') {
      const lines = importResults.trim().split('\n');
      ingestedCount = lines.filter(line => {
        try {
          const parsed = JSON.parse(line);
          return parsed.success !== false;
        } catch (e) {
          return true;
        }
      }).length;
    } else if (Array.isArray(importResults)) {
      ingestedCount = importResults.filter(item => item.success !== false).length;
    }

    res.status(200).json({ ingested: ingestedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ingest-catalog (Helper for UI to list catalog.json documents)
app.get('/api/ingest-catalog', (req, res) => {
  try {
    const catalogPath = path.join(__dirname, 'data', 'catalog.json');
    if (fs.existsSync(catalogPath)) {
      const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      res.status(200).json(catalogData);
    } else {
      res.status(404).json({ error: 'Catalog file not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server after initializing Typesense
initTypesense().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});
