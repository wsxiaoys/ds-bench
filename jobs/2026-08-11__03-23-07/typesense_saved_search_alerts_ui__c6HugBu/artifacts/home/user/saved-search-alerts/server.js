const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 8080;
const TYPESENSE_HOST = 'http://127.0.0.1:8108';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to get API key
function getApiKey() {
  try {
    return fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
  } catch (err) {
    console.error('Error reading typesense api key:', err);
    return '';
  }
}

const SAVED_SEARCHES_FILE = path.join(__dirname, 'data', 'saved_searches.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

function loadSavedSearches() {
  if (fs.existsSync(SAVED_SEARCHES_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SAVED_SEARCHES_FILE, 'utf8'));
    } catch (e) {
      console.error('Error parsing saved searches, starting fresh:', e.message);
      return [];
    }
  }
  return [];
}

function saveSavedSearches(searches) {
  fs.writeFileSync(SAVED_SEARCHES_FILE, JSON.stringify(searches, null, 2), 'utf8');
}

// Helper to query Typesense and get ALL matching document IDs
async function getMatchingDocumentIds(q, category, max_price) {
  const API_KEY = getApiKey();
  const queryText = q && q.trim() !== '' ? q.trim() : '*';
  
  const filters = [];
  if (category && category.trim() !== '') {
    filters.push(`category:=[${category.trim()}]`);
  }
  if (max_price !== null && max_price !== undefined && max_price !== '') {
    filters.push(`price:<=${max_price}`);
  }
  
  const filterBy = filters.join(' && ');
  
  let page = 1;
  const perPage = 250;
  const ids = [];
  
  while (true) {
    let url = `${TYPESENSE_HOST}/collections/products/documents/search?q=${encodeURIComponent(queryText)}&query_by=name&per_page=${perPage}&page=${page}`;
    if (filterBy) {
      url += `&filter_by=${encodeURIComponent(filterBy)}`;
    }
    
    const res = await fetch(url, {
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Typesense search failed: ${res.statusText} - ${errText}`);
    }
    
    const data = await res.json();
    const hits = data.hits || [];
    for (const hit of hits) {
      if (hit.document && hit.document.id) {
        ids.push(hit.document.id);
      }
    }
    
    const found = data.found || 0;
    if (ids.length >= found || hits.length < perPage) {
      break;
    }
    page++;
  }
  
  return ids;
}

// Ensure products collection exists and contains baseline documents
async function ensureProductsCollectionAndBaseline() {
  const API_KEY = getApiKey();
  
  let collectionExists = false;
  try {
    const res = await fetch(`${TYPESENSE_HOST}/collections/products`, {
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });
    if (res.status === 200) {
      collectionExists = true;
    }
  } catch (err) {
    console.error('Error checking products collection:', err.message);
  }
  
  if (!collectionExists) {
    console.log('Creating products collection...');
    const schema = {
      name: 'products',
      fields: [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'category', type: 'string', facet: true },
        { name: 'price', type: 'float' }
      ]
    };
    const res = await fetch(`${TYPESENSE_HOST}/collections`, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(schema)
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to create products collection: ${errText}`);
    }
    console.log('Products collection created successfully.');
  }
  
  // Index baseline documents
  const baselinePath = path.join(__dirname, 'data', 'baseline.json');
  if (fs.existsSync(baselinePath)) {
    console.log('Indexing baseline documents...');
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const jsonl = baseline.map(doc => JSON.stringify(doc)).join('\n');
    const importRes = await fetch(`${TYPESENSE_HOST}/collections/products/documents/import?action=upsert`, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': API_KEY,
        'Content-Type': 'text/plain'
      },
      body: jsonl
    });
    if (!importRes.ok) {
      const errText = await importRes.text();
      throw new Error(`Failed to import baseline documents: ${errText}`);
    }
    console.log('Baseline documents imported successfully.');
  } else {
    console.warn(`Baseline file not found at ${baselinePath}`);
  }
}

// API Endpoints

// GET /api/catalog - helper for UI to fetch catalog.json
app.get('/api/catalog', (req, res) => {
  const catalogPath = path.join(__dirname, 'data', 'catalog.json');
  if (fs.existsSync(catalogPath)) {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    res.status(200).json(catalog);
  } else {
    res.status(404).json({ error: 'Catalog file not found' });
  }
});

// POST /api/saved-searches
app.post('/api/saved-searches', (req, res) => {
  const { name, q, category, max_price } = req.body;
  if (typeof name !== 'string' || typeof q !== 'string' || typeof category !== 'string') {
    return res.status(400).json({ error: 'Invalid input fields' });
  }
  
  const newSearch = {
    id: crypto.randomUUID(),
    name,
    q,
    category,
    max_price: (max_price === undefined || max_price === null) ? null : Number(max_price),
    match_count: null,
    new_count: null,
    checked_ids: null
  };
  
  const searches = loadSavedSearches();
  searches.push(newSearch);
  saveSavedSearches(searches);
  
  const responseObj = {
    id: newSearch.id,
    name: newSearch.name,
    q: newSearch.q,
    category: newSearch.category,
    max_price: newSearch.max_price,
    match_count: newSearch.match_count,
    new_count: newSearch.new_count
  };
  
  res.status(201).json(responseObj);
});

// GET /api/saved-searches
app.get('/api/saved-searches', (req, res) => {
  const searches = loadSavedSearches();
  const responseList = searches.map(s => ({
    id: s.id,
    name: s.name,
    q: s.q,
    category: s.category,
    max_price: s.max_price,
    match_count: s.match_count,
    new_count: s.new_count
  }));
  res.status(200).json(responseList);
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
    const currentIds = await getMatchingDocumentIds(search.q, search.category, search.max_price);
    
    let newCount = null;
    if (search.checked_ids === null || search.checked_ids === undefined) {
      newCount = 0;
    } else {
      const previousSet = new Set(search.checked_ids);
      newCount = currentIds.filter(id => !previousSet.has(id)).length;
    }
    
    search.match_count = currentIds.length;
    search.new_count = newCount;
    search.checked_ids = currentIds;
    
    searches[searchIndex] = search;
    saveSavedSearches(searches);
    
    const responseObj = {
      id: search.id,
      name: search.name,
      q: search.q,
      category: search.category,
      max_price: search.max_price,
      match_count: search.match_count,
      new_count: search.new_count
    };
    
    res.status(200).json(responseObj);
  } catch (err) {
    console.error(`Error checking saved search ${id}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/check-all
app.post('/api/check-all', async (req, res) => {
  const searches = loadSavedSearches();
  const updatedSearches = [];
  
  for (const search of searches) {
    try {
      const currentIds = await getMatchingDocumentIds(search.q, search.category, search.max_price);
      
      let newCount = null;
      if (search.checked_ids === null || search.checked_ids === undefined) {
        newCount = 0;
      } else {
        const previousSet = new Set(search.checked_ids);
        newCount = currentIds.filter(id => !previousSet.has(id)).length;
      }
      
      search.match_count = currentIds.length;
      search.new_count = newCount;
      search.checked_ids = currentIds;
      
      updatedSearches.push(search);
    } catch (err) {
      console.error(`Error checking search ${search.id}:`, err);
      updatedSearches.push(search);
    }
  }
  
  saveSavedSearches(updatedSearches);
  
  const responseList = updatedSearches.map(s => ({
    id: s.id,
    name: s.name,
    q: s.q,
    category: s.category,
    max_price: s.max_price,
    match_count: s.match_count,
    new_count: s.new_count
  }));
  
  res.status(200).json(responseList);
});

// POST /api/ingest
app.post('/api/ingest', async (req, res) => {
  const { documents } = req.body;
  if (!Array.isArray(documents)) {
    return res.status(400).json({ error: 'documents must be an array' });
  }
  
  if (documents.length === 0) {
    return res.status(200).json({ ingested: 0 });
  }
  
  try {
    const jsonl = documents.map(doc => JSON.stringify(doc)).join('\n');
    const API_KEY = getApiKey();
    
    const importRes = await fetch(`${TYPESENSE_HOST}/collections/products/documents/import?action=upsert`, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': API_KEY,
        'Content-Type': 'text/plain'
      },
      body: jsonl
    });
    
    if (!importRes.ok) {
      const errText = await importRes.text();
      throw new Error(`Failed to ingest documents: ${errText}`);
    }
    
    const importText = await importRes.text();
    const lines = importText.trim().split('\n');
    let ingestedCount = 0;
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.success) {
          ingestedCount++;
        }
      } catch (e) {
        // ignore parse errors
      }
    }
    
    res.status(200).json({ ingested: ingestedCount });
  } catch (err) {
    console.error('Error during ingestion:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start Server
async function start() {
  try {
    await ensureProductsCollectionAndBaseline();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Fatal error during startup:', err);
    process.exit(1);
  }
}

start();
