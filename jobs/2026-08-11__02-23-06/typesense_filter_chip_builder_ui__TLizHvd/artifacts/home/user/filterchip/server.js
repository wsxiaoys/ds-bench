const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
app.use(express.json());

// Read API Key
let API_KEY = '';
try {
  API_KEY = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
} catch (err) {
  console.error('Error reading API key from /etc/typesense-api-key:', err);
  process.exit(1);
}

const TYPESENSE_URL = 'http://127.0.0.1:8108';

async function initTypesense() {
  console.log('Initializing Typesense collection...');
  try {
    // Delete collection if exists
    try {
      await fetch(`${TYPESENSE_URL}/collections/products`, {
        method: 'DELETE',
        headers: { 'X-TYPESENSE-API-KEY': API_KEY }
      });
    } catch (e) {
      // Ignore
    }

    // Create collection
    const schema = {
      name: 'products',
      fields: [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'category', type: 'string', facet: true },
        { name: 'brand', type: 'string', facet: true },
        { name: 'price', type: 'float', facet: true },
        { name: 'rating', type: 'float', facet: true },
        { name: 'tags', type: 'string[]', facet: true }
      ]
    };

    const res = await fetch(`${TYPESENSE_URL}/collections`, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(schema)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to create collection: ${res.statusText} - ${errText}`);
    }
    console.log('Collection created successfully!');

    // Read products.jsonl and index them
    const fileContent = fs.readFileSync('/home/user/filterchip/data/products.jsonl', 'utf8');
    const docs = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => JSON.parse(line));

    console.log(`Found ${docs.length} documents to index.`);

    const jsonlData = docs.map(d => JSON.stringify(d)).join('\n');
    const importRes = await fetch(`${TYPESENSE_URL}/collections/products/documents/import?action=create`, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': API_KEY,
        'Content-Type': 'text/plain'
      },
      body: jsonlData
    });

    const importText = await importRes.text();
    console.log('Import response:', importText);
  } catch (error) {
    console.error('Typesense initialization error:', error);
  }
}

// Validation and Normalization
const ALLOWED_FIELDS = ['id', 'name', 'category', 'brand', 'price', 'rating', 'tags'];

function validateAndNormalize(node) {
  if (!node) return null;

  // Group Node
  if (node.op !== undefined) {
    if (node.op !== 'and' && node.op !== 'or') {
      const err = new Error(`Invalid operator: ${node.op}`);
      err.status = 400;
      throw err;
    }
    if (!Array.isArray(node.children)) {
      const err = new Error(`Children must be an array`);
      err.status = 400;
      throw err;
    }
    const children = node.children.map(validateAndNormalize).filter(Boolean);
    return { op: node.op, children };
  }

  // Condition Node
  if (node.field !== undefined) {
    if (!ALLOWED_FIELDS.includes(node.field)) {
      const err = new Error(`Invalid field: ${node.field}`);
      err.status = 400;
      throw err;
    }

    const { field, cmp, value } = node;
    const validCmps = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in'];
    if (!validCmps.includes(cmp)) {
      const err = new Error(`Invalid comparator: ${cmp}`);
      err.status = 400;
      throw err;
    }

    if (value === undefined || value === null) {
      const err = new Error(`Value is required for condition`);
      err.status = 400;
      throw err;
    }

    // Normalize value
    let normValue = value;
    if (field === 'price' || field === 'rating') {
      if (cmp === 'between') {
        if (!Array.isArray(value) || value.length !== 2) {
          const err = new Error(`Value for between must be [low, high]`);
          err.status = 400;
          throw err;
        }
        const low = Number(value[0]);
        const high = Number(value[1]);
        if (isNaN(low) || !isFinite(low) || isNaN(high) || !isFinite(high)) {
          const err = new Error(`Invalid numeric range: ${JSON.stringify(value)}`);
          err.status = 400;
          throw err;
        }
        normValue = [low, high];
      } else if (cmp === 'in') {
        if (!Array.isArray(value)) {
          const err = new Error(`Value for in must be an array`);
          err.status = 400;
          throw err;
        }
        normValue = value.map(v => {
          const n = Number(v);
          if (isNaN(n) || !isFinite(n)) {
            const err = new Error(`Invalid numeric value in set: ${v}`);
            err.status = 400;
            throw err;
          }
          return n;
        });
      } else {
        const n = Number(value);
        if (isNaN(n) || !isFinite(n)) {
          const err = new Error(`Invalid numeric value: ${value}`);
          err.status = 400;
          throw err;
        }
        normValue = n;
      }
    } else {
      // String fields (id, name, category, brand, tags)
      if (cmp === 'between') {
        const err = new Error(`Comparator 'between' is not supported for string fields`);
        err.status = 400;
        throw err;
      }
      if (cmp === 'in') {
        if (!Array.isArray(value)) {
          const err = new Error(`Value for in must be an array`);
          err.status = 400;
          throw err;
        }
        normValue = value.map(v => String(v));
      } else {
        normValue = String(value);
      }
    }

    return { field, cmp, value: normValue };
  }

  const err = new Error(`Invalid node structure: must be a Group or Condition`);
  err.status = 400;
  throw err;
}

// Simplification
function simplify(node) {
  if (!node) return null;

  if (node.field !== undefined) {
    return node;
  }

  if (node.op !== undefined) {
    const children = node.children || [];
    if (children.length === 0) {
      return null;
    }

    const simplifiedChildren = [];
    let hasAlwaysTrueChild = false;

    for (const child of children) {
      const simplifiedChild = simplify(child);
      if (simplifiedChild === null) {
        hasAlwaysTrueChild = true;
      } else {
        simplifiedChildren.push(simplifiedChild);
      }
    }

    if (node.op === 'and') {
      if (simplifiedChildren.length === 0) {
        return null;
      }
      if (simplifiedChildren.length === 1) {
        return simplifiedChildren[0];
      }
      return { op: 'and', children: simplifiedChildren };
    } else if (node.op === 'or') {
      if (hasAlwaysTrueChild) {
        return null;
      }
      if (simplifiedChildren.length === 0) {
        return null;
      }
      if (simplifiedChildren.length === 1) {
        return simplifiedChildren[0];
      }
      return { op: 'or', children: simplifiedChildren };
    }
  }

  return null;
}

// Translation
function buildConditionFilter(node) {
  const { field, cmp, value } = node;

  const escapeVal = (v) => {
    if (typeof v === 'string') {
      return `\`${v.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\``;
    }
    return String(v);
  };

  switch (cmp) {
    case 'eq':
      return `${field}:=${escapeVal(value)}`;
    case 'ne':
      return `${field}:!=${escapeVal(value)}`;
    case 'gt':
      return `${field}:>${value}`;
    case 'gte':
      return `${field}:>=${value}`;
    case 'lt':
      return `${field}:<${value}`;
    case 'lte':
      return `${field}:<=${value}`;
    case 'between':
      return `${field}:[${value[0]}..${value[1]}]`;
    case 'in':
      return `${field}:=[${value.map(v => escapeVal(v)).join(', ')}]`;
    default:
      throw new Error(`Invalid comparator: ${cmp}`);
  }
}

function buildFilterExpression(node) {
  if (!node) return '';

  if (node.field !== undefined) {
    return buildConditionFilter(node);
  }

  if (node.op !== undefined) {
    const opStr = node.op === 'or' ? ' || ' : ' && ';
    const childrenExprs = node.children
      .map(child => buildFilterExpression(child))
      .filter(Boolean);

    if (childrenExprs.length === 0) {
      return '';
    }
    if (childrenExprs.length === 1) {
      return childrenExprs[0];
    }
    return `(${childrenExprs.join(opStr)})`;
  }

  return '';
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// GET /api/products
app.get('/api/products', async (req, res) => {
  try {
    const tsRes = await fetch(`${TYPESENSE_URL}/collections/products/documents/search?q=*&limit=250`, {
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });
    if (!tsRes.ok) {
      const errText = await tsRes.text();
      return res.status(500).json({ error: errText });
    }
    const data = await tsRes.json();
    const products = data.hits.map(h => h.document);
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/filter
app.post('/api/filter', async (req, res) => {
  try {
    const filterInput = req.body.filter;
    
    let normFilter = null;
    if (filterInput) {
      try {
        normFilter = validateAndNormalize(filterInput);
      } catch (err) {
        if (err.status === 400) {
          return res.status(400).json({ error: err.message });
        }
        throw err;
      }
    }

    const simplified = simplify(normFilter);
    const filterBy = buildFilterExpression(simplified);

    console.log('Generated filter_by expression:', filterBy);

    let url = `${TYPESENSE_URL}/collections/products/documents/search?q=*&limit=250`;
    if (filterBy) {
      url += `&filter_by=${encodeURIComponent(filterBy)}`;
    }

    const tsRes = await fetch(url, {
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });

    if (!tsRes.ok) {
      const errText = await tsRes.text();
      console.error('Typesense search error:', errText);
      return res.status(500).json({ error: `Typesense error: ${errText}` });
    }

    const data = await tsRes.json();
    const ids = data.hits.map(h => h.document.id);
    
    return res.json({
      ids,
      count: ids.length
    });

  } catch (error) {
    console.error('Server error in POST /api/filter:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = 8080;
async function start() {
  await initTypesense();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

start();
