const express = require('express');
const Typesense = require('typesense');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Read Typesense API key from file
const apiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();

// Create Typesense client
const typesenseClient = new Typesense.Client({
  'nodes': [{
    'host': process.env.TYPESENSE_HOST || '127.0.0.1',
    'port': parseInt(process.env.TYPESENSE_PORT || '8108'),
    'protocol': process.env.TYPESENSE_PROTOCOL || 'http'
  }],
  'apiKey': apiKey,
  'connectionTimeoutSeconds': 5
});

// Idempotent initialization of Typesense collection
async function initTypesense() {
  const collectionName = 'products';
  
  try {
    // Check if collection exists, if so delete it
    await typesenseClient.collections(collectionName).delete();
    console.log(`Deleted existing collection: ${collectionName}`);
  } catch (err) {
    // Collection didn't exist, which is fine
  }

  const schema = {
    'name': collectionName,
    'fields': [
      { 'name': 'name', 'type': 'string' },
      { 'name': 'brand', 'type': 'string', 'facet': true },
      { 'name': 'popularity', 'type': 'int32' },
      { 'name': 'price', 'type': 'float' }
    ],
    'default_sorting_field': 'popularity'
  };

  await typesenseClient.collections().create(schema);
  console.log(`Created collection: ${collectionName}`);

  // Load products.jsonl dataset
  const datasetPath = path.join(__dirname, 'data', 'products.jsonl');
  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Dataset file not found at ${datasetPath}`);
  }

  const fileContent = fs.readFileSync(datasetPath, 'utf8');
  const documents = fileContent
    .trim()
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line));

  console.log(`Loading ${documents.length} documents into Typesense...`);
  await typesenseClient.collections(collectionName).documents().import(documents, { action: 'upsert' });
  console.log('Successfully loaded dataset into Typesense.');
}

app.get('/', async (req, res) => {
  try {
    const q = req.query.q || '';
    const page = parseInt(req.query.page) || 1;

    // Search query to Typesense
    const searchParams = {
      q: q.trim() === '' ? '*' : q,
      query_by: 'name',
      sort_by: 'popularity:desc',
      per_page: 100 // fetch all matching products to do grouping & pagination in Node.js
    };

    console.log(`Searching Typesense with params:`, searchParams);
    const searchResults = await typesenseClient.collections('products').documents().search(searchParams);

    const hits = searchResults.hits || [];

    // Group by brand in Node.js
    const groupsMap = new Map();
    for (const hit of hits) {
      const item = hit.document;
      const brand = item.brand;
      if (!groupsMap.has(brand)) {
        groupsMap.set(brand, {
          brand: brand,
          items: [],
          total: 0
        });
      }
      const group = groupsMap.get(brand);
      group.items.push(item);
      group.total++;
    }

    const groups = Array.from(groupsMap.values());
    const totalGroups = groups.length;
    const limit = 3;
    const totalPages = Math.max(1, Math.ceil(totalGroups / limit));
    
    // Clamp page to valid range
    let currentPage = page;
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedGroups = groups.slice(startIndex, endIndex);

    // Render the HTML
    const html = renderPage({
      q,
      page: currentPage,
      totalPages,
      groups: paginatedGroups,
      totalGroups
    });

    res.send(html);
  } catch (err) {
    console.error('Error handling request:', err);
    res.status(500).send('Internal Server Error');
  }
});

function renderPage({ q, page, totalPages, groups, totalGroups }) {
  const groupHtml = groups.map(group => {
    // Show initially at most 3 items
    const initialItems = group.items.slice(0, 3);
    const remainingItems = group.items.slice(3);

    const itemsHtml = initialItems.map(item => `
      <div data-testid="item" data-id="${item.id}" class="product-item">
        <div class="product-name">${escapeHtml(item.name)}</div>
        <div class="product-details">
          <span class="price">$${item.price.toFixed(2)}</span>
          <span class="popularity">Popularity: ${item.popularity}</span>
        </div>
      </div>
    `).join('');

    const showMoreHtml = group.total > 3 ? `
      <button data-testid="show-more" class="show-more-btn" data-remaining="${escapeAttribute(JSON.stringify(remainingItems))}">
        Show more
      </button>
    ` : '';

    return `
      <div data-testid="group" data-brand="${escapeAttribute(group.brand)}" data-total="${group.total}" class="brand-group">
        <div class="brand-header">
          <span class="brand-name">${escapeHtml(group.brand)}</span>
          <span class="brand-count">(${group.total} products matched)</span>
        </div>
        <div class="items-list">
          ${itemsHtml}
        </div>
        ${showMoreHtml}
      </div>
    `;
  }).join('');

  const prevControl = page > 1 
    ? `<a href="/?q=${encodeURIComponent(q)}&page=${page - 1}" data-testid="prev-page" class="nav-btn">Previous</a>`
    : `<button disabled data-testid="prev-page" class="nav-btn">Previous</button>`;

  const nextControl = page < totalPages 
    ? `<a href="/?q=${encodeURIComponent(q)}&page=${page + 1}" data-testid="next-page" class="nav-btn">Next</a>`
    : `<button disabled data-testid="next-page" class="nav-btn">Next</button>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Grouped Search Results Storefront</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f5f5f7;
      color: #1d1d1f;
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      font-size: 32px;
      font-weight: 700;
      text-align: center;
      margin-bottom: 30px;
    }
    .search-form {
      display: flex;
      gap: 10px;
      margin-bottom: 30px;
    }
    .search-form input {
      flex: 1;
      padding: 12px 16px;
      font-size: 16px;
      border: 1px solid #d2d2d7;
      border-radius: 8px;
      outline: none;
      background-color: #fff;
    }
    .search-form input:focus {
      border-color: #0071e3;
      box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.15);
    }
    .search-form button {
      padding: 12px 24px;
      font-size: 16px;
      background-color: #0071e3;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }
    .search-form button:hover {
      background-color: #0077ed;
    }
    .brand-group {
      background-color: #fff;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    }
    .brand-header {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 16px;
      border-bottom: 1px solid #f5f5f7;
      padding-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand-name {
      color: #1d1d1f;
    }
    .brand-count {
      font-size: 14px;
      color: #86868b;
    }
    .items-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .product-item {
      padding: 12px 16px;
      background-color: #f5f5f7;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .product-name {
      font-weight: 500;
      color: #1d1d1f;
    }
    .product-details {
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .price {
      font-weight: 600;
      color: #0071e3;
    }
    .popularity {
      font-size: 12px;
      color: #86868b;
      background-color: #e8e8ed;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .show-more-btn {
      margin-top: 16px;
      width: 100%;
      padding: 10px;
      background-color: #fff;
      border: 1px solid #0071e3;
      color: #0071e3;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s ease;
    }
    .show-more-btn:hover {
      background-color: #0071e3;
      color: #fff;
    }
    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 40px;
    }
    .nav-btn {
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      color: #0071e3;
      background-color: #fff;
      border: 1px solid #d2d2d7;
      border-radius: 8px;
      cursor: pointer;
      display: inline-block;
    }
    .nav-btn:hover:not([disabled]) {
      border-color: #0071e3;
    }
    .nav-btn[disabled] {
      color: #86868b;
      background-color: #f5f5f7;
      border-color: #e8e8ed;
      cursor: not-allowed;
    }
    .page-indicator {
      font-size: 14px;
      font-weight: 600;
      color: #1d1d1f;
    }
    .no-results {
      text-align: center;
      padding: 40px;
      color: #86868b;
      font-size: 18px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Storefront Search</h1>
    
    <form action="/" method="GET" class="search-form">
      <input type="text" name="q" value="${escapeHtml(q)}" data-testid="search-input" placeholder="Search products by name...">
      <button type="submit">Search</button>
    </form>

    <div class="results-container">
      ${groupHtml || '<div class="no-results">No products matched your search.</div>'}
    </div>

    <div class="pagination">
      ${prevControl}
      <span data-testid="page-indicator" class="page-indicator">Page ${page} of ${totalPages}</span>
      ${nextControl}
    </div>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('[data-testid="show-more"]').forEach(button => {
        button.addEventListener('click', () => {
          const group = button.closest('[data-testid="group"]');
          const itemsList = group.querySelector('.items-list');
          const remainingItems = JSON.parse(button.getAttribute('data-remaining'));
          
          remainingItems.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.setAttribute('data-testid', 'item');
            itemEl.setAttribute('data-id', item.id);
            itemEl.className = 'product-item';
            itemEl.innerHTML = \`
              <div class="product-name">\${escapeHtml(item.name)}</div>
              <div class="product-details">
                <span class="price">\$\${item.price.toFixed(2)}</span>
                <span class="popularity">Popularity: \${item.popularity}</span>
              </div>
            \`;
            itemsList.appendChild(itemEl);
          });
          
          button.remove();
        });
      });
    });

    function escapeHtml(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  </script>
</body>
</html>
  `;
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function startServer() {
  let retries = 5;
  while (retries > 0) {
    try {
      await initTypesense();
      break;
    } catch (err) {
      console.error('Error initializing Typesense, retrying in 2 seconds...', err);
      retries--;
      if (retries === 0) {
        console.error('Failed to initialize Typesense after multiple retries.');
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
