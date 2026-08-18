import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const TYPESENSE_URL = 'http://127.0.0.1:8108';
const API_KEY = 'kPVJcFDqdf3x4g7l4fsWvukgjj8UlFjn';
const PORT = 8080;

// Read products dataset once on startup
const productsPath = '/home/user/filterchip/data/products.jsonl';
let products = [];
try {
  const fileContent = fs.readFileSync(productsPath, 'utf8');
  products = fileContent.trim().split('\n').map(line => JSON.parse(line));
  console.log(`Loaded ${products.length} products from dataset`);
} catch (err) {
  console.error('Error loading products dataset:', err);
}

// Function to index products into Typesense
async function initTypesense() {
  console.log('Initializing Typesense collection...');
  
  // 1. Delete collection if exists
  try {
    const delRes = await fetch(`${TYPESENSE_URL}/collections/products`, {
      method: 'DELETE',
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });
    if (delRes.ok) {
      console.log('Deleted existing products collection');
    }
  } catch (e) {
    console.log('No existing collection to delete');
  }

  // 2. Create products collection
  const schema = {
    name: 'products',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string', facet: true },
      { name: 'category', type: 'string', facet: true },
      { name: 'brand', type: 'string', facet: true },
      { name: 'price', type: 'float', facet: true },
      { name: 'rating', type: 'float', facet: true },
      { name: 'tags', type: 'string[]', facet: true }
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
    const errorData = await createRes.json();
    console.error('Failed to create collection:', errorData);
    process.exit(1);
  }
  console.log('Created products collection successfully');

  // 3. Index products
  for (const doc of products) {
    const indexRes = await fetch(`${TYPESENSE_URL}/collections/products/documents`, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(doc)
    });
    if (!indexRes.ok) {
      const errData = await indexRes.json();
      console.error(`Failed to index product ${doc.id}:`, errData);
    }
  }
  console.log(`Indexed all ${products.length} products successfully`);
}

// Translate structured JSON filter tree into Typesense filter_by expression
function translateNode(node) {
  if (!node) {
    return "";
  }

  // Group Node
  if ('op' in node && 'children' in node) {
    const op = node.op.toLowerCase();
    if (op !== 'and' && op !== 'or') {
      const err = new Error(`Invalid group operator: ${node.op}`);
      err.statusCode = 400;
      throw err;
    }
    if (!Array.isArray(node.children)) {
      const err = new Error(`Group children must be an array`);
      err.statusCode = 400;
      throw err;
    }

    const translatedChildren = node.children
      .map(child => translateNode(child))
      .filter(str => str !== "");

    if (translatedChildren.length === 0) {
      return "";
    }
    if (translatedChildren.length === 1) {
      return translatedChildren[0];
    }
    const joinOp = op === 'or' ? ' || ' : ' && ';
    return `(${translatedChildren.join(joinOp)})`;
  }

  // Condition Node
  if ('field' in node && 'cmp' in node && 'value' in node) {
    const allowedFields = ["id", "name", "category", "brand", "price", "rating", "tags"];
    if (!allowedFields.includes(node.field)) {
      const err = new Error(`Invalid field: ${node.field}`);
      err.statusCode = 400;
      throw err;
    }

    const field = node.field;
    const cmp = node.cmp;
    const value = node.value;

    function escapeStr(val) {
      if (typeof val !== 'string') {
        val = String(val);
      }
      return val.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
    }

    function formatVal(val) {
      if (typeof val === 'number') {
        return val;
      }
      return `\`${escapeStr(val)}\``;
    }

    switch (cmp) {
      case 'eq': {
        if (typeof value === 'number') {
          return `${field}:=${value}`;
        } else {
          return `${field}:=${formatVal(value)}`;
        }
      }
      case 'ne': {
        if (typeof value === 'number') {
          return `${field}:!=${value}`;
        } else {
          return `${field}:!=${formatVal(value)}`;
        }
      }
      case 'gt': {
        if (typeof value !== 'number') {
          const err = new Error(`Value for gt must be a number`);
          err.statusCode = 400;
          throw err;
        }
        return `${field}:>${value}`;
      }
      case 'gte': {
        if (typeof value !== 'number') {
          const err = new Error(`Value for gte must be a number`);
          err.statusCode = 400;
          throw err;
        }
        return `${field}:>=${value}`;
      }
      case 'lt': {
        if (typeof value !== 'number') {
          const err = new Error(`Value for lt must be a number`);
          err.statusCode = 400;
          throw err;
        }
        return `${field}:<${value}`;
      }
      case 'lte': {
        if (typeof value !== 'number') {
          const err = new Error(`Value for lte must be a number`);
          err.statusCode = 400;
          throw err;
        }
        return `${field}:<=${value}`;
      }
      case 'between': {
        if (!Array.isArray(value) || value.length !== 2) {
          const err = new Error(`Value for between must be an array of [low, high]`);
          err.statusCode = 400;
          throw err;
        }
        const [low, high] = value;
        if (typeof low !== 'number' || typeof high !== 'number') {
          const err = new Error(`Range values for between must be numbers`);
          err.statusCode = 400;
          throw err;
        }
        return `${field}:[${low}..${high}]`;
      }
      case 'in': {
        if (!Array.isArray(value)) {
          const err = new Error(`Value for in must be an array`);
          err.statusCode = 400;
          throw err;
        }
        const formattedVals = value.map(v => formatVal(v));
        return `${field}:=[${formattedVals.join(', ')}]`;
      }
      default: {
        const err = new Error(`Invalid comparator: ${cmp}`);
        err.statusCode = 400;
        throw err;
      }
    }
  }

  const err = new Error(`Invalid node structure`);
  err.statusCode = 400;
  throw err;
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/products', (req, res) => {
  res.json(products);
});

app.post('/api/filter', async (req, res) => {
  try {
    const filter = req.body.filter;
    let filterBy = "";
    
    try {
      filterBy = translateNode(filter);
    } catch (err) {
      if (err.statusCode === 400) {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }

    console.log(`Translated filter_by: "${filterBy}"`);

    // Fetch matching documents from Typesense with per_page=250 to ensure we get the full set
    let searchUrl = `${TYPESENSE_URL}/collections/products/documents/search?q=*&per_page=250`;
    if (filterBy) {
      searchUrl += `&filter_by=${encodeURIComponent(filterBy)}`;
    }

    const typesenseRes = await fetch(searchUrl, {
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });

    if (!typesenseRes.ok) {
      const errData = await typesenseRes.json();
      return res.status(500).json({ error: 'Typesense search failed', details: errData });
    }

    const data = await typesenseRes.json();
    const ids = data.hits ? data.hits.map(h => h.document.id) : [];

    return res.json({
      ids: ids,
      count: ids.length
    });
  } catch (err) {
    console.error('Filter API Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server after initializing Typesense
async function start() {
  await initTypesense();
  app.listen(PORT, () => {
    console.log(`Web server listening on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
