const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TYPESENSE_HOST = 'http://127.0.0.1:8108';
const API_KEY = 'XiKwGzOimJpb7rQhnIYHPTGjm6X9xhpO';
const collectionName = 'products';

const VALID_FIELDS = new Set(['id', 'name', 'category', 'brand', 'price', 'rating', 'tags']);

// Helper to escape string values for Typesense filter_by
function escapeValue(val) {
  if (typeof val === 'string') {
    const escaped = val.replace(/`/g, '\\`');
    return `\`${escaped}\``;
  }
  return val;
}

// Recursive compiler from Node to Typesense filter_by string
function compileNode(node) {
  if (!node) return '';

  // 1. Group Node
  if (node.op !== undefined) {
    const op = String(node.op).toLowerCase();
    if (op !== 'and' && op !== 'or') {
      const err = new Error(`Invalid operator: ${op}`);
      err.statusCode = 400;
      throw err;
    }
    
    const children = node.children || [];
    if (!Array.isArray(children)) {
      const err = new Error(`Children must be an array`);
      err.statusCode = 400;
      throw err;
    }

    const compiledChildren = [];
    for (const child of children) {
      const compiled = compileNode(child);
      if (compiled) {
        compiledChildren.push(compiled);
      }
    }

    if (compiledChildren.length === 0) {
      return '';
    }
    if (compiledChildren.length === 1) {
      return compiledChildren[0];
    }

    const separator = op === 'and' ? ' && ' : ' || ';
    return `(${compiledChildren.join(separator)})`;
  }

  // 2. Condition Node
  const { field, cmp, value } = node;
  if (!field) {
    const err = new Error(`Missing field in condition node`);
    err.statusCode = 400;
    throw err;
  }

  if (!VALID_FIELDS.has(field)) {
    const err = new Error(`Invalid field: ${field}`);
    err.statusCode = 400;
    throw err;
  }

  if (!cmp) {
    const err = new Error(`Missing cmp in condition node for field ${field}`);
    err.statusCode = 400;
    throw err;
  }

  switch (cmp) {
    case 'eq':
      return `${field}:=${escapeValue(value)}`;
    case 'ne':
      return `${field}:!=${escapeValue(value)}`;
    case 'gt':
      return `${field}:>${value}`;
    case 'gte':
      return `${field}:>=${value}`;
    case 'lt':
      return `${field}:<${value}`;
    case 'lte':
      return `${field}:<=${value}`;
    case 'between': {
      if (!Array.isArray(value) || value.length !== 2) {
        const err = new Error(`Invalid value for 'between' comparator: ${JSON.stringify(value)}`);
        err.statusCode = 400;
        throw err;
      }
      return `${field}:[${value[0]}..${value[1]}]`;
    }
    case 'in': {
      if (!Array.isArray(value)) {
        const err = new Error(`Invalid value for 'in' comparator: ${JSON.stringify(value)}`);
        err.statusCode = 400;
        throw err;
      }
      if (value.length === 0) {
        // Return a filter that matches nothing
        return `id:=\`impossible_non_existent_id\``;
      }
      const escapedValues = value.map(val => escapeValue(val));
      return `${field}:=[${escapedValues.join(', ')}]`;
    }
    default: {
      const err = new Error(`Invalid comparator: ${cmp}`);
      err.statusCode = 400;
      throw err;
    }
  }
}

// Endpoint: POST /api/filter
app.post('/api/filter', async (req, res) => {
  try {
    const { filter } = req.body;
    
    // Compile filter tree to Typesense filter_by string
    let filterBy = '';
    if (filter) {
      filterBy = compileNode(filter);
    }

    // Query Typesense
    let url = `${TYPESENSE_HOST}/collections/${collectionName}/documents/search?q=*&per_page=250`;
    if (filterBy) {
      url += `&filter_by=${encodeURIComponent(filterBy)}`;
    }

    console.log(`Querying Typesense with filter_by: "${filterBy}"`);

    const tsRes = await fetch(url, {
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });

    if (!tsRes.ok) {
      const errText = await tsRes.text();
      console.error('Typesense search error:', errText);
      return res.status(500).json({ error: 'Typesense search failed', details: errText });
    }

    const searchResult = await tsRes.json();
    const hits = searchResult.hits || [];
    const ids = hits.map(hit => hit.document.id);
    const count = ids.length;

    return res.json({ ids, count });
  } catch (err) {
    console.error('API Error:', err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
});

// GET / - served by express.static on 'public' folder (will fall back if index.html is there)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint: GET /api/products - returns all products from Typesense
app.get('/api/products', async (req, res) => {
  try {
    const url = `${TYPESENSE_HOST}/collections/${collectionName}/documents/search?q=*&per_page=250`;
    const tsRes = await fetch(url, {
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });
    if (!tsRes.ok) {
      const errText = await tsRes.text();
      return res.status(500).json({ error: 'Failed to fetch products', details: errText });
    }
    const searchResult = await tsRes.json();
    const hits = searchResult.hits || [];
    const products = hits.map(hit => hit.document);
    return res.json(products);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Automatic indexing function on startup
async function indexDataset() {
  console.log('=== Starting Dataset Indexing ===');
  
  // 1. Delete collection if exists
  try {
    await fetch(`${TYPESENSE_HOST}/collections/${collectionName}`, {
      method: 'DELETE',
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });
    console.log('Deleted existing collection.');
  } catch (e) {
    console.log('Collection delete error (might not exist):', e.message);
  }

  // 2. Create collection
  const schema = {
    name: collectionName,
    fields: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'category', type: 'string', facet: true },
      { name: 'brand', type: 'string', facet: true },
      { name: 'price', type: 'float' },
      { name: 'rating', type: 'float' },
      { name: 'tags', type: 'string[]', facet: true }
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
    const errText = await createRes.text();
    console.error('Failed to create collection:', errText);
    process.exit(1);
  }
  console.log('Collection created successfully.');

  // 3. Read and index documents
  const dataPath = path.join(__dirname, 'data', 'products.jsonl');
  if (!fs.existsSync(dataPath)) {
    console.error(`Dataset not found at ${dataPath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(dataPath, 'utf8');
  const lines = fileContent.split('\n').filter(line => line.trim() !== '');
  
  console.log(`Found ${lines.length} documents to index.`);
  
  const importRes = await fetch(`${TYPESENSE_HOST}/collections/${collectionName}/documents/import?action=create`, {
    method: 'POST',
    headers: {
      'X-TYPESENSE-API-KEY': API_KEY,
      'Content-Type': 'text/plain'
    },
    body: lines.join('\n')
  });

  if (!importRes.ok) {
    const errText = await importRes.text();
    console.error('Failed to import documents:', errText);
    process.exit(1);
  }

  const importText = await importRes.text();
  console.log('Documents imported successfully.');
  console.log('=== Indexing Complete ===');
}

// Start Server
const PORT = 8080;
indexDataset().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}).catch(err => {
  console.error('Startup error:', err);
  process.exit(1);
});
