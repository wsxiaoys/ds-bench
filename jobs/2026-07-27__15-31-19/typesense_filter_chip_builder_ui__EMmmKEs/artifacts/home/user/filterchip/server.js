const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = 8080;
const TYPESENSE_HOST = 'http://127.0.0.1:8108';
const API_KEY = 'BpXn5H4kecGZCkdccUltHtVkIC4ZwYcM';

const VALID_FIELDS = ["id", "name", "category", "brand", "price", "rating", "tags"];

// Helper to escape backticks and backslashes in Typesense filter values
function escapeFilterValue(val) {
  if (typeof val !== 'string') return val;
  const escaped = val.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  return `\`${escaped}\``;
}

// Helper to determine if a node is always true (empty group)
function isAlwaysTrue(node) {
  return node && node.op && (!node.children || node.children.length === 0);
}

// Translate a filter tree node to a Typesense filter_by string
function translateNode(node) {
  if (!node) return "";
  
  if (isAlwaysTrue(node)) {
    return "";
  }
  
  if (node.op) {
    const op = node.op.toLowerCase();
    if (op !== 'and' && op !== 'or') {
      throw new Error(`Invalid group operator: ${node.op}`);
    }
    
    if (!node.children || !Array.isArray(node.children)) {
      return "";
    }
    
    const childrenFilters = node.children
      .map(child => translateNode(child))
      .filter(f => f !== "");
      
    if (childrenFilters.length === 0) {
      return "";
    }
    if (childrenFilters.length === 1) {
      return childrenFilters[0];
    }
    
    const opStr = op === "or" ? " || " : " && ";
    return "(" + childrenFilters.join(opStr) + ")";
  } else {
    const { field, cmp, value } = node;
    
    if (!VALID_FIELDS.includes(field)) {
      const err = new Error(`Invalid field: ${field}`);
      err.status = 400;
      throw err;
    }
    
    if (cmp === "eq") {
      if (typeof value === "string") {
        return `${field}:=${escapeFilterValue(value)}`;
      } else {
        return `${field}:=${value}`;
      }
    } else if (cmp === "ne") {
      if (typeof value === "string") {
        return `${field}:!=${escapeFilterValue(value)}`;
      } else {
        return `${field}:!=${value}`;
      }
    } else if (["gt", "gte", "lt", "lte"].includes(cmp)) {
      const opSign = { gt: ">", gte: ">=", lt: "<", lte: "<=" }[cmp];
      return `${field}:${opSign}${value}`;
    } else if (cmp === "between") {
      if (!Array.isArray(value) || value.length !== 2) {
        throw new Error(`Value for "between" must be [low, high]`);
      }
      const [low, high] = value;
      return `${field}:[${low}..${high}]`;
    } else if (cmp === "in") {
      if (!Array.isArray(value)) {
        throw new Error(`Value for "in" must be an array`);
      }
      const escapedVals = value.map(val => {
        if (typeof val === "string") {
          return escapeFilterValue(val);
        } else {
          return val;
        }
      });
      return `${field}:=[${escapedVals.join(", ")}]`;
    } else {
      throw new Error(`Invalid comparator: ${cmp}`);
    }
  }
}

// Function to fetch all matching documents from Typesense using pagination if needed
async function fetchAllDocuments(filterBy) {
  let allHits = [];
  let page = 1;
  const perPage = 250;
  
  while (true) {
    const url = new URL(`${TYPESENSE_HOST}/collections/products/documents/search`);
    url.searchParams.set('q', '*');
    url.searchParams.set('per_page', perPage.toString());
    url.searchParams.set('page', page.toString());
    if (filterBy) {
      url.searchParams.set('filter_by', filterBy);
    }
    
    const res = await fetch(url.toString(), {
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Typesense search failed: ${text}`);
    }
    
    const data = await res.json();
    allHits = allHits.concat(data.hits || []);
    
    if (allHits.length >= data.found || !data.hits || data.hits.length < perPage) {
      break;
    }
    page++;
  }
  
  return allHits;
}

// Function to index data on startup
async function initTypesense() {
  console.log("Initializing Typesense collection 'products'...");
  
  // 1. Delete collection if it exists
  try {
    await fetch(`${TYPESENSE_HOST}/collections/products`, {
      method: 'DELETE',
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });
  } catch (e) {
    // Ignore if not exists
  }
  
  // 2. Create collection
  const schema = {
    name: 'products',
    fields: [
      { name: 'name', type: 'string' },
      { name: 'category', type: 'string', facet: true },
      { name: 'brand', type: 'string', facet: true },
      { name: 'price', type: 'float', facet: true },
      { name: 'rating', type: 'float', facet: true },
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
  
  if (createRes.status !== 201) {
    const text = await createRes.text();
    throw new Error(`Failed to create collection: ${text}`);
  }
  
  // 3. Import documents from products.jsonl
  const dataPath = '/home/user/filterchip/data/products.jsonl';
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Dataset not found at ${dataPath}`);
  }
  
  const data = fs.readFileSync(dataPath, 'utf8');
  const importRes = await fetch(`${TYPESENSE_HOST}/collections/products/documents/import?action=upsert`, {
    method: 'POST',
    headers: {
      'X-TYPESENSE-API-KEY': API_KEY,
      'Content-Type': 'text/plain'
    },
    body: data
  });
  
  if (importRes.status !== 200) {
    const text = await importRes.text();
    throw new Error(`Failed to import documents: ${text}`);
  }
  
  console.log("Typesense initialized and products indexed successfully!");
}

// POST /api/filter
app.post('/api/filter', async (req, res) => {
  try {
    const { filter } = req.body;
    
    // Translate the filter tree to Typesense filter_by expression
    let filterBy = "";
    try {
      filterBy = translateNode(filter);
    } catch (err) {
      if (err.status === 400) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message || "Invalid filter structure" });
    }
    
    console.log(`Generated filter_by expression: "${filterBy}"`);
    
    // Fetch matching documents
    const hits = await fetchAllDocuments(filterBy);
    const ids = hits.map(h => h.document.id);
    
    return res.json({
      ids: ids,
      count: ids.length,
      filterBy: filterBy
    });
  } catch (error) {
    console.error("Error in /api/filter:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// GET /api/products
// Optional endpoint to fetch all products with their id and name for display in the UI
app.get('/api/products', async (req, res) => {
  try {
    const hits = await fetchAllDocuments("");
    const products = hits.map(h => h.document);
    return res.json({ products });
  } catch (error) {
    console.error("Error in /api/products:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// GET / - Serves the single-page application
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
async function start() {
  await initTypesense();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
