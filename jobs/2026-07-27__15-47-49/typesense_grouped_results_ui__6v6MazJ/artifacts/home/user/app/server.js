const http = require('http');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Typesense = require('typesense');

const TYPESENSE_HOST = process.env.TYPESENSE_HOST || '127.0.0.1';
const TYPESENSE_PORT = parseInt(process.env.TYPESENSE_PORT || '8108', 10);
const TYPESENSE_PROTOCOL = process.env.TYPESENSE_PROTOCOL || 'http';
const TYPESENSE_API_KEY = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();

const PORT = 3000;
const COLLECTION = 'products';
const PER_GROUP_LIMIT = 3;
const GROUPS_PER_PAGE = 3;

const client = new Typesense.Client({
  nodes: [{ host: TYPESENSE_HOST, port: TYPESENSE_PORT, protocol: TYPESENSE_PROTOCOL }],
  apiKey: TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 5,
});

async function ensureCollection() {
  try {
    await client.collections(COLLECTION).retrieve();
    console.log(`Collection '${COLLECTION}' already exists.`);
  } catch {
    console.log(`Creating collection '${COLLECTION}'...`);
    await client.collections().create({
      name: COLLECTION,
      fields: [
        { name: 'name', type: 'string' },
        { name: 'brand', type: 'string', facet: true },
        { name: 'popularity', type: 'int32' },
        { name: 'price', type: 'float' },
      ],
    });
    console.log(`Collection '${COLLECTION}' created.`);
  }
}

async function loadData() {
  const filePath = path.join(__dirname, 'data', 'products.jsonl');
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  const products = [];
  for await (const line of rl) {
    if (line.trim()) {
      products.push(JSON.parse(line));
    }
  }

  console.log(`Loaded ${products.length} products from dataset.`);

  // Use upsert for idempotency
  const result = await client.collections(COLLECTION).documents().import(products, { action: 'upsert' });
  console.log('Import result:', JSON.stringify(result, null, 2));
}

// Grouped search: we query Typesense with group_by=brand, group_limit=PER_GROUP_LIMIT,
// and then paginate the groups manually.
async function search(query, page) {
  const searchParams = {
    q: query || '*',
    query_by: 'name',
    group_by: 'brand',
    group_limit: PER_GROUP_LIMIT,
    sort_by: '_text_match:desc,popularity:desc',
    per_page: 100, // get all groups, we paginate ourselves
  };

  const result = await client.collections(COLLECTION).documents().search(searchParams);

  // result.grouped_hits contains the grouped results
  const groupedHits = result.grouped_hits || [];

  // Each group has: group_key (list), found (total), hits (limited items)
  // Sort groups by the max popularity in each group (descending)
  const groups = groupedHits.map((g) => {
    const brand = g.group_key[0];
    const total = g.found;
    const items = (g.hits || []).map((h) => ({
      id: h.document.id,
      name: h.document.name,
      brand: h.document.brand,
      popularity: h.document.popularity,
      price: h.document.price,
    }));
    return { brand, total, items };
  });

  // Sort groups by the highest popularity item in each group (descending)
  groups.sort((a, b) => {
    const aMax = Math.max(...a.items.map((i) => i.popularity), 0);
    const bMax = Math.max(...b.items.map((i) => i.popularity), 0);
    return bMax - aMax;
  });

  // Paginate groups
  const totalGroups = groups.length;
  const totalPages = Math.max(1, Math.ceil(totalGroups / GROUPS_PER_PAGE));
  const startIdx = (page - 1) * GROUPS_PER_PAGE;
  const pagedGroups = groups.slice(startIdx, startIdx + GROUPS_PER_PAGE);

  return { groups: pagedGroups, page, totalPages, totalGroups };
}

// Fetch all items for a specific brand (for "show more")
async function fetchBrandItems(brand) {
  const result = await client
    .collections(COLLECTION)
    .documents()
    .search({
      q: '*',
      query_by: 'name',
      filter_by: `brand:=${brand}`,
      sort_by: 'popularity:desc',
      per_page: 250,
    });

  return (result.hits || []).map((h) => ({
    id: h.document.id,
    name: h.document.name,
    brand: h.document.brand,
    popularity: h.document.popularity,
    price: h.document.price,
  }));
}

function renderPage(data) {
  const { groups, page, totalPages, query } = data;
  const prevDisabled = page <= 1 ? 'disabled' : '';
  const nextDisabled = page >= totalPages ? 'disabled' : '';

  const groupsHtml = groups
    .map((g) => {
      const showMore = g.total > PER_GROUP_LIMIT;
      const itemsHtml = g.items
        .map(
          (item) =>
            `<li data-testid="item" data-id="${escapeHtml(item.id)}">${escapeHtml(item.name)} — $${item.price.toFixed(2)} (pop: ${item.popularity})</li>`
        )
        .join('');

      return `
      <div data-testid="group" data-brand="${escapeHtml(g.brand)}" data-total="${g.total}">
        <h2>${escapeHtml(g.brand)} <span class="total">(${g.total} products)</span></h2>
        <ul>${itemsHtml}</ul>
        ${showMore ? `<button data-testid="show-more" data-brand="${escapeHtml(g.brand)}">Show more</button>` : ''}
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Storefront</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    [data-testid="group"] { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    [data-testid="group"] h2 { margin: 0 0 8px 0; }
    .total { font-size: 0.9em; color: #666; font-weight: normal; }
    ul { margin: 0; padding-left: 20px; }
    li { margin-bottom: 4px; }
    button { cursor: pointer; padding: 6px 14px; border: 1px solid #999; border-radius: 4px; background: #fff; margin-top: 8px; }
    button:hover { background: #f0f0f0; }
    button:disabled { opacity: 0.5; cursor: default; }
    .pagination { display: flex; align-items: center; gap: 12px; margin: 20px 0; }
    .search-form { margin-bottom: 20px; }
    .search-form input { padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; width: 300px; font-size: 16px; }
    .search-form button { margin-left: 8px; }
  </style>
</head>
<body>
  <h1>Product Storefront</h1>
  <form class="search-form" method="GET" action="/">
    <input type="text" name="q" data-testid="search-input" value="${escapeHtml(query || '')}" placeholder="Search products...">
    <input type="hidden" name="page" value="1">
    <button type="submit">Search</button>
  </form>

  <div class="pagination">
    <button data-testid="prev-page" ${prevDisabled} onclick="goPage(${page - 1})">Previous</button>
    <span data-testid="page-indicator">Page ${page} of ${totalPages}</span>
    <button data-testid="next-page" ${nextDisabled} onclick="goPage(${page + 1})">Next</button>
  </div>

  <div id="results">
    ${groupsHtml || '<p>No results found.</p>'}
  </div>

  <script>
    function goPage(p) {
      const q = document.querySelector('[data-testid="search-input"]').value;
      window.location.href = '/?q=' + encodeURIComponent(q) + '&page=' + p;
    }

    // Handle "Show more" clicks via AJAX
    document.querySelectorAll('[data-testid="show-more"]').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        const brand = this.dataset.brand;
        const groupEl = this.closest('[data-testid="group"]');
        try {
          const resp = await fetch('/api/brand-items?brand=' + encodeURIComponent(brand));
          const items = await resp.json();
          const ul = groupEl.querySelector('ul');
          ul.innerHTML = items.map(function(item) {
            return '<li data-testid="item" data-id="' + item.id + '">' + item.name + ' — $' + item.price.toFixed(2) + ' (pop: ' + item.popularity + ')</li>';
          }).join('');
          this.remove();
        } catch(e) {
          console.error(e);
        }
      });
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseQuery(url) {
  const parsed = new URL(url, 'http://localhost');
  const q = parsed.searchParams.get('q') || '';
  const page = Math.max(1, parseInt(parsed.searchParams.get('page') || '1', 10) || 1);
  return { q, page };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url.startsWith('/api/brand-items')) {
      const parsed = new URL(req.url, 'http://localhost');
      const brand = parsed.searchParams.get('brand') || '';
      const items = await fetchBrandItems(brand);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(items));
      return;
    }

    if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
      const { q, page } = parseQuery(req.url);
      const data = await search(q, page);
      data.query = q;
      const html = renderPage(data);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

async function main() {
  await ensureCollection();
  await loadData();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Startup error:', err);
  process.exit(1);
});
