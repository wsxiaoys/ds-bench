const express = require('express');
const Typesense = require('typesense');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Read Typesense API key from file or environment
let typesenseApiKey = process.env.TYPESENSE_API_KEY;
if (!typesenseApiKey) {
  try {
    typesenseApiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
  } catch (e) {
    console.error('Error reading /etc/typesense-api-key:', e.message);
  }
}

const typesenseHost = process.env.TYPESENSE_HOST || '127.0.0.1';
const typesensePort = parseInt(process.env.TYPESENSE_PORT || '8108');
const typesenseProtocol = process.env.TYPESENSE_PROTOCOL || 'http';

const client = new Typesense.Client({
  nodes: [{
    host: typesenseHost,
    port: typesensePort,
    protocol: typesenseProtocol
  }],
  apiKey: typesenseApiKey,
  connectionTimeoutSeconds: 5
});

// Helper to escape HTML to prevent XSS and DOM breaking
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Idempotent Typesense initialization
async function initTypesense() {
  console.log('Initializing Typesense collection...');
  try {
    await client.collections('products').delete();
    console.log('Existing products collection deleted.');
  } catch (e) {
    // Collection did not exist, which is fine
  }

  const schema = {
    name: 'products',
    fields: [
      { name: 'name', type: 'string' },
      { name: 'brand', type: 'string', facet: true },
      { name: 'popularity', type: 'int32' },
      { name: 'price', type: 'float' }
    ],
    default_sorting_field: 'popularity'
  };

  await client.collections().create(schema);
  console.log('Products collection schema created.');

  // Load products.jsonl
  const jsonlPath = path.join(__dirname, 'data', 'products.jsonl');
  if (!fs.existsSync(jsonlPath)) {
    throw new Error(`Dataset file not found at ${jsonlPath}`);
  }

  const fileStream = fs.createReadStream(jsonlPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const documents = [];
  for await (const line of rl) {
    if (line.trim()) {
      try {
        documents.push(JSON.parse(line));
      } catch (err) {
        console.error('Failed to parse line:', line, err);
      }
    }
  }

  if (documents.length > 0) {
    console.log(`Importing ${documents.length} products into Typesense...`);
    const importResults = await client.collections('products').documents().import(documents, { action: 'upsert' });
    const failedImports = importResults.filter(res => res.success === false);
    if (failedImports.length > 0) {
      console.error('Some imports failed:', failedImports);
    } else {
      console.log('All products imported successfully.');
    }
  } else {
    console.warn('No products found in products.jsonl to import.');
  }
}

// Serve search page
app.get('/', async (req, res) => {
  try {
    const q = req.query.q || '';
    const pageParam = parseInt(req.query.page) || 1;

    // Search Typesense
    // q: q || '*' matches all products when q is empty
    const searchResults = await client.collections('products').documents().search({
      q: q || '*',
      query_by: 'name',
      sort_by: 'popularity:desc',
      per_page: 250 // Retrieve all matching products to perform pagination & grouping in Node
    });

    const hits = searchResults.hits || [];
    const products = hits.map(hit => hit.document);

    // Group by brand
    const groupsMap = {};
    for (const p of products) {
      if (!groupsMap[p.brand]) {
        groupsMap[p.brand] = {
          brand: p.brand,
          items: [],
          maxPopularity: p.popularity
        };
      }
      groupsMap[p.brand].items.push(p);
    }

    // Convert to array and sort brand groups by maxPopularity descending
    const groups = Object.values(groupsMap);
    groups.sort((a, b) => b.maxPopularity - a.maxPopularity);

    // Sort items within each group by popularity descending (already sorted, but let's be explicit)
    for (const g of groups) {
      g.items.sort((a, b) => b.popularity - a.popularity);
    }

    // Paginate groups (3 groups per page)
    const groupsPerPage = 3;
    const totalGroups = groups.length;
    const totalPages = Math.max(1, Math.ceil(totalGroups / groupsPerPage));
    
    let currentPage = pageParam;
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * groupsPerPage;
    const endIndex = startIndex + groupsPerPage;
    const pageGroups = groups.slice(startIndex, endIndex);

    const prevPageNum = currentPage > 1 ? currentPage - 1 : null;
    const nextPageNum = currentPage < totalPages ? currentPage + 1 : null;

    // Render HTML response
    let groupsHtml = '';
    if (pageGroups.length === 0) {
      groupsHtml = '<div class="no-results">No products found matching your search.</div>';
    } else {
      for (const g of pageGroups) {
        const totalItems = g.items.length;
        const initialItems = g.items.slice(0, 3);
        const extraItems = g.items.slice(3);

        let itemsHtml = '';
        for (const item of initialItems) {
          itemsHtml += `
            <div class="product-item" data-testid="item" data-id="${escapeHTML(item.id)}">
              <div class="product-header">
                <span class="product-name">${escapeHTML(item.name)}</span>
                <span class="product-price">$${item.price.toFixed(2)}</span>
              </div>
              <div class="product-details">
                Popularity: <strong class="popularity-badge">${item.popularity}</strong>
              </div>
            </div>
          `;
        }

        const showMoreButton = totalItems > 3 
          ? `<button data-testid="show-more" class="show-more-btn">Show more</button>` 
          : '';

        const extraDataAttr = totalItems > 3 
          ? `data-extra="${escapeHTML(JSON.stringify(extraItems))}"` 
          : '';

        groupsHtml += `
          <div class="brand-group" data-testid="group" data-brand="${escapeHTML(g.brand)}" data-total="${totalItems}" ${extraDataAttr}>
            <div class="brand-header">
              <span class="brand-name">${escapeHTML(g.brand)}</span>
              <span class="brand-count">${totalItems} ${totalItems === 1 ? 'product' : 'products'} matched</span>
            </div>
            <div class="items-container">
              ${itemsHtml}
            </div>
            ${showMoreButton}
          </div>
        `;
      }
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Grouped Storefront</title>
  <style>
    :root {
      --primary-color: #3b82f6;
      --primary-hover: #2563eb;
      --bg-color: #f3f4f6;
      --card-bg: #ffffff;
      --text-color: #1f2937;
      --text-muted: #6b7280;
      --border-color: #e5e7eb;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      margin: 0;
      padding: 20px;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    h1 {
      text-align: center;
      color: #111827;
      margin-bottom: 24px;
    }

    .search-form {
      display: flex;
      gap: 10px;
      margin-bottom: 30px;
    }

    .search-input {
      flex: 1;
      padding: 12px 16px;
      font-size: 16px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      outline: none;
      transition: border-color 0.2s;
    }

    .search-input:focus {
      border-color: var(--primary-color);
    }

    .search-btn {
      padding: 12px 24px;
      font-size: 16px;
      background-color: var(--primary-color);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: background-color 0.2s;
    }

    .search-btn:hover {
      background-color: var(--primary-hover);
    }

    .brand-group {
      background-color: var(--card-bg);
      border-radius: 12px;
      border: 1px solid var(--border-color);
      padding: 20px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .brand-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid var(--border-color);
      padding-bottom: 12px;
      margin-bottom: 16px;
    }

    .brand-name {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
    }

    .brand-count {
      font-size: 14px;
      color: var(--text-muted);
      background-color: #e5e7eb;
      padding: 4px 10px;
      border-radius: 9999px;
      font-weight: 500;
    }

    .items-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .product-item {
      background-color: #f9fafb;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 14px;
      transition: box-shadow 0.2s;
    }

    .product-item:hover {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .product-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .product-name {
      font-weight: 600;
      font-size: 16px;
      color: #111827;
    }

    .product-price {
      font-weight: 700;
      color: var(--primary-color);
    }

    .product-details {
      font-size: 13px;
      color: var(--text-muted);
    }

    .popularity-badge {
      color: #059669;
    }

    .show-more-btn {
      margin-top: 16px;
      width: 100%;
      padding: 10px;
      background-color: transparent;
      border: 1px dashed var(--primary-color);
      color: var(--primary-color);
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .show-more-btn:hover {
      background-color: #eff6ff;
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 20px;
      margin-top: 40px;
      margin-bottom: 40px;
    }

    .pagination-btn {
      padding: 10px 20px;
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      color: var(--text-color);
      text-decoration: none;
      font-weight: 600;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .pagination-btn:hover:not(.disabled) {
      border-color: var(--primary-color);
      color: var(--primary-color);
    }

    .pagination-btn.disabled {
      color: var(--text-muted);
      background-color: #f3f4f6;
      border-color: var(--border-color);
      cursor: not-allowed;
      pointer-events: none;
    }

    .page-indicator {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-color);
    }

    .no-results {
      text-align: center;
      padding: 40px;
      background-color: var(--card-bg);
      border-radius: 12px;
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      font-size: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Product Storefront</h1>
    <form action="/" method="GET" class="search-form">
      <input 
        type="text" 
        name="q" 
        value="${escapeHTML(q)}" 
        placeholder="Search products..." 
        class="search-input" 
        data-testid="search-input"
        autocomplete="off"
      />
      <button type="submit" class="search-btn">Search</button>
    </form>

    <div class="results-container">
      ${groupsHtml}
    </div>

    <div class="pagination">
      <a 
        href="${prevPageNum ? `/?q=${encodeURIComponent(q)}&page=${prevPageNum}` : '#'}" 
        data-testid="prev-page" 
        class="pagination-btn ${!prevPageNum ? 'disabled' : ''}"
      >Previous</a>
      <span data-testid="page-indicator" class="page-indicator">Page ${currentPage}</span>
      <a 
        href="${nextPageNum ? `/?q=${encodeURIComponent(q)}&page=${nextPageNum}` : '#'}" 
        data-testid="next-page" 
        class="pagination-btn ${!nextPageNum ? 'disabled' : ''}"
      >Next</a>
    </div>
  </div>

  <script>
    // Handle Show more client-side dynamically to ensure elements > 3 are not present initially
    document.addEventListener('click', function(e) {
      if (e.target && e.target.getAttribute('data-testid') === 'show-more') {
        const group = e.target.closest('[data-testid="group"]');
        if (!group) return;

        const extraDataRaw = group.getAttribute('data-extra');
        if (!extraDataRaw) return;

        try {
          const extraItems = JSON.parse(extraDataRaw);
          const container = group.querySelector('.items-container');
          
          extraItems.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'product-item';
            itemEl.setAttribute('data-testid', 'item');
            itemEl.setAttribute('data-id', item.id);
            
            // Re-create the item inner HTML safely
            const nameEscaped = escapeHTML(item.name);
            const idEscaped = escapeHTML(item.id);
            const priceFormatted = item.price.toFixed(2);
            const popularityFormatted = item.popularity;

            itemEl.innerHTML = \`
              <div class="product-header">
                <span class="product-name">\${nameEscaped}</span>
                <span class="product-price">$\${priceFormatted}</span>
              </div>
              <div class="product-details">
                Popularity: <strong class="popularity-badge">\${popularityFormatted}</strong>
              </div>
            \`;
            container.appendChild(itemEl);
          });

          // Remove the show-more button as all items are now shown
          e.target.remove();
        } catch (err) {
          console.error('Error parsing extra items:', err);
        }
      }
    });

    // Helper to escape HTML in client script
    function escapeHTML(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  </script>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    console.error('Error processing search request:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Start Express server after initializing Typesense
async function startServer() {
  try {
    await initTypesense();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is listening on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize Typesense or start server:', error);
    process.exit(1);
  }
}

startServer();
