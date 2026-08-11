const express = require('express');
const Typesense = require('typesense');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Read Typesense configurations from environment variables
const host = process.env.TYPESENSE_HOST || '127.0.0.1';
const port = parseInt(process.env.TYPESENSE_PORT || '8108', 10);
const protocol = process.env.TYPESENSE_PROTOCOL || 'http';

// Read API key from the file /etc/typesense-api-key
let apiKey = '';
try {
  apiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
} catch (err) {
  console.error('Error reading API key file /etc/typesense-api-key:', err);
  process.exit(1);
}

const client = new Typesense.Client({
  'nodes': [{
    'host': host,
    'port': port,
    'protocol': protocol
  }],
  'apiKey': apiKey,
  'connectionTimeoutSeconds': 5
});

// Helper to escape HTML to prevent XSS and ensure valid attributes
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function waitTypesenseReady() {
  const maxRetries = 20;
  const delayMs = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`Checking if Typesense is ready (attempt ${i + 1}/${maxRetries})...`);
      // A simple collections list request will succeed only when typesense is fully ready
      await client.collections().retrieve();
      console.log('Typesense is ready!');
      return;
    } catch (err) {
      console.log(`Typesense not ready yet: ${err.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error('Typesense server did not become ready in time.');
}

async function initTypesense() {
  // Wait for Typesense to be ready first
  await waitTypesenseReady();

  const schema = {
    'name': 'products',
    'fields': [
      { 'name': 'name', 'type': 'string' },
      { 'name': 'brand', 'type': 'string', 'facet': true },
      { 'name': 'popularity', 'type': 'int32' },
      { 'name': 'price', 'type': 'float' }
    ],
    'default_sorting_field': 'popularity'
  };

  try {
    console.log('Checking if collection products exists...');
    await client.collections('products').delete();
    console.log('Deleted existing products collection');
  } catch (err) {
    // Collection didn't exist
  }

  console.log('Creating products collection...');
  await client.collections().create(schema);

  console.log('Loading products dataset...');
  const dataPath = path.join(__dirname, 'data', 'products.jsonl');
  const fileContent = fs.readFileSync(dataPath, 'utf8');
  const lines = fileContent.split('\n').filter(line => line.trim() !== '');
  const documents = lines.map(line => JSON.parse(line));

  await client.collections('products').documents().import(documents, { action: 'upsert' });
  console.log(`Successfully loaded ${documents.length} products into Typesense.`);
}

app.get('/', async (req, res) => {
  const q = req.query.q || '';
  const page = parseInt(req.query.page || '1', 10);

  try {
    // Search Typesense
    const searchParams = {
      'q': q || '*',
      'query_by': 'name',
      'sort_by': 'popularity:desc',
      'per_page': 250
    };

    const searchResult = await client.collections('products').documents().search(searchParams);
    const hits = searchResult.hits || [];

    // Group items by brand
    const groupsMap = new Map();
    for (const hit of hits) {
      const doc = hit.document;
      const brand = doc.brand;
      if (!groupsMap.has(brand)) {
        groupsMap.set(brand, {
          brand: brand,
          total: 0,
          items: []
        });
      }
      const group = groupsMap.get(brand);
      group.items.push({
        id: doc.id,
        name: doc.name,
        brand: doc.brand,
        popularity: doc.popularity,
        price: doc.price
      });
      group.total += 1;
    }

    // Since hits were sorted by popularity:desc, the groups are naturally ordered by
    // their highest popularity item descending.
    const groups = Array.from(groupsMap.values());

    // Pagination at the group level
    const itemsPerPage = 3;
    const totalGroups = groups.length;
    const totalPages = Math.max(1, Math.ceil(totalGroups / itemsPerPage));
    const currentPage = Math.max(1, Math.min(page, totalPages));

    const paginatedGroups = groups.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Build Groups HTML
    let groupsHtml = '';
    if (paginatedGroups.length === 0) {
      groupsHtml = '<div class="no-results">No products found matching your search.</div>';
    } else {
      for (const group of paginatedGroups) {
        // Initially show at most 3 items
        const initialItems = group.items.slice(0, 3);
        const initialItemsHtml = initialItems.map(item => `
          <div class="product-item" data-testid="item" data-id="${escapeHtml(item.id)}">
            <div class="product-info">
              <h3>${escapeHtml(item.name)}</h3>
              <p>Popularity: ${item.popularity}</p>
            </div>
            <div class="product-price">$${item.price.toFixed(2)}</div>
          </div>
        `).join('');

        const showMoreBtnHtml = group.total > 3 
          ? `<button class="show-more-btn" data-testid="show-more">Show more</button>` 
          : '';

        // Safe JSON stringification for data attribute
        const escapedItemsData = escapeHtml(JSON.stringify(group.items));

        groupsHtml += `
          <div class="brand-group" data-testid="group" data-brand="${escapeHtml(group.brand)}" data-total="${group.total}" data-items="${escapedItemsData}">
            <div class="brand-header">
              <h2 class="brand-title">${escapeHtml(group.brand)}</h2>
              <span class="brand-count">${group.total} products matched</span>
            </div>
            <div class="items-container">
              ${initialItemsHtml}
            </div>
            ${showMoreBtnHtml}
          </div>
        `;
      }
    }

    // Build Pagination HTML
    const prevPageUrl = currentPage > 1 ? `/?q=${encodeURIComponent(q)}&page=${currentPage - 1}` : '#';
    const nextPageUrl = currentPage < totalPages ? `/?q=${encodeURIComponent(q)}&page=${currentPage + 1}` : '#';

    const paginationHtml = `
      <div class="pagination-container">
        <a href="${prevPageUrl}" class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" data-testid="prev-page">Previous</a>
        <span class="page-indicator" data-testid="page-indicator">Page ${currentPage} of ${totalPages}</span>
        <a href="${nextPageUrl}" class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" data-testid="next-page">Next</a>
      </div>
    `;

    // Render Full Page
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Grouped Search Results Storefront</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
            color: #333;
          }
          h1 {
            text-align: center;
            margin-bottom: 30px;
          }
          .search-container {
            margin-bottom: 30px;
            display: flex;
            justify-content: center;
          }
          .search-form {
            display: flex;
            width: 100%;
            max-width: 600px;
          }
          .search-input {
            flex: 1;
            padding: 12px 16px;
            font-size: 16px;
            border: 1px solid #ccc;
            border-radius: 4px 0 0 4px;
            outline: none;
          }
          .search-button {
            padding: 12px 24px;
            font-size: 16px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 0 4px 4px 0;
            cursor: pointer;
          }
          .search-button:hover {
            background-color: #0056b3;
          }
          .brand-group {
            background-color: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          .brand-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          .brand-title {
            margin: 0;
            font-size: 20px;
            color: #222;
          }
          .brand-count {
            background-color: #e9ecef;
            color: #495057;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
          }
          .items-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .product-item {
            padding: 12px;
            border: 1px solid #f0f0f0;
            border-radius: 6px;
            background-color: #fafafa;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .product-info h3 {
            margin: 0 0 4px 0;
            font-size: 16px;
          }
          .product-info p {
            margin: 0;
            color: #666;
            font-size: 14px;
          }
          .product-price {
            font-size: 16px;
            font-weight: bold;
            color: #28a745;
          }
          .show-more-btn {
            display: block;
            width: 100%;
            padding: 10px;
            margin-top: 15px;
            background-color: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            text-align: center;
            transition: background-color 0.2s;
          }
          .show-more-btn:hover {
            background-color: #e2e6ea;
          }
          .pagination-container {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 20px;
            margin-top: 40px;
            margin-bottom: 20px;
          }
          .pagination-btn {
            padding: 8px 16px;
            background-color: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            text-decoration: none;
            color: #333;
            font-size: 14px;
          }
          .pagination-btn:hover:not(.disabled) {
            background-color: #f1f1f1;
          }
          .pagination-btn.disabled {
            color: #ccc;
            border-color: #eee;
            cursor: not-allowed;
            pointer-events: none;
          }
          .page-indicator {
            font-size: 14px;
            font-weight: 500;
          }
          .no-results {
            text-align: center;
            font-size: 18px;
            color: #666;
            margin-top: 40px;
          }
        </style>
      </head>
      <body>
        <h1>Product Storefront</h1>
        
        <div class="search-container">
          <form class="search-form" method="GET" action="/">
            <input type="text" name="q" value="${escapeHtml(q)}" class="search-input" data-testid="search-input" placeholder="Search products..." />
            <button type="submit" class="search-button">Search</button>
          </form>
        </div>

        <div class="results-container">
          ${groupsHtml}
        </div>

        ${paginationHtml}

        <script>
          document.addEventListener('click', function(event) {
            if (event.target.matches('[data-testid="show-more"]')) {
              const groupEl = event.target.closest('[data-testid="group"]');
              const itemsContainer = groupEl.querySelector('.items-container');
              const itemsData = JSON.parse(groupEl.getAttribute('data-items'));
              
              // Clear the items container and render all items
              itemsContainer.innerHTML = '';
              itemsData.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'product-item';
                itemEl.setAttribute('data-testid', 'item');
                itemEl.setAttribute('data-id', item.id);
                itemEl.innerHTML = \`
                  <div class="product-info">
                    <h3>\${escapeHtml(item.name)}</h3>
                    <p>Popularity: \${item.popularity}</p>
                  </div>
                  <div class="product-price">\$\${item.price.toFixed(2)}</div>
                \`;
                itemsContainer.appendChild(itemEl);
              });
              
              // Remove the "Show more" button
              event.target.remove();
            }
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

    res.send(html);
  } catch (err) {
    console.error('Error serving search page:', err);
    res.status(500).send('Internal Server Error');
  }
});

async function start() {
  try {
    await initTypesense();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize and start server:', err);
    process.exit(1);
  }
}

start();
