const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Resolve API key from environment or file
let apiKey = 'xyz';
if (fs.existsSync('/etc/typesense-api-key')) {
  apiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
}

console.log('Resolved Typesense API key:', apiKey);

// Initialize Typesense collections and rules
async function initTypesense() {
  console.log('Initializing Typesense collections and rules...');

  // 1. Delete catalog collection if it exists, then create it
  try {
    await fetch('http://127.0.0.1:8108/collections/catalog', {
      method: 'DELETE',
      headers: { 'X-TYPESENSE-API-KEY': apiKey }
    });
  } catch (e) {}

  const catalogSchema = {
    name: 'catalog',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'price', type: 'float' }
    ]
  };

  let res = await fetch('http://127.0.0.1:8108/collections', {
    method: 'POST',
    headers: {
      'X-TYPESENSE-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(catalogSchema)
  });
  console.log('Created catalog collection status:', res.status);

  // 2. Create popular_queries collection if it doesn't exist
  let popularExists = false;
  try {
    const checkRes = await fetch('http://127.0.0.1:8108/collections/popular_queries', {
      headers: { 'X-TYPESENSE-API-KEY': apiKey }
    });
    if (checkRes.ok) popularExists = true;
  } catch (e) {}

  if (!popularExists) {
    const popularQueriesSchema = {
      name: 'popular_queries',
      fields: [
        { name: 'q', type: 'string' },
        { name: 'count', type: 'int32' }
      ]
    };
    await fetch('http://127.0.0.1:8108/collections', {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(popularQueriesSchema)
    });
    console.log('Created popular_queries collection');

    // Create popular_queries rule
    const popularRule = {
      name: 'catalog_popular_queries_rule',
      type: 'popular_queries',
      params: {
        source: { collections: ['catalog'] },
        destination: { collection: 'popular_queries' },
        limit: 1000
      }
    };
    await fetch('http://127.0.0.1:8108/analytics/rules', {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(popularRule)
    });
    console.log('Created popular_queries analytics rule');
  }

  // 3. Create no_hits_queries collection if it doesn't exist
  let noHitsExists = false;
  try {
    const checkRes = await fetch('http://127.0.0.1:8108/collections/no_hits_queries', {
      headers: { 'X-TYPESENSE-API-KEY': apiKey }
    });
    if (checkRes.ok) noHitsExists = true;
  } catch (e) {}

  if (!noHitsExists) {
    const noHitsQueriesSchema = {
      name: 'no_hits_queries',
      fields: [
        { name: 'q', type: 'string' },
        { name: 'count', type: 'int32' }
      ]
    };
    await fetch('http://127.0.0.1:8108/collections', {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(noHitsQueriesSchema)
    });
    console.log('Created no_hits_queries collection');

    // Create nohits_queries rule
    const noHitsRule = {
      name: 'catalog_no_hits_queries_rule',
      type: 'nohits_queries',
      params: {
        source: { collections: ['catalog'] },
        destination: { collection: 'no_hits_queries' },
        limit: 1000
      }
    };
    await fetch('http://127.0.0.1:8108/analytics/rules', {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(noHitsRule)
    });
    console.log('Created nohits_queries analytics rule');
  }

  // 4. Import seed file
  const seedPath = '/home/user/trendsearch/catalog-seed.json';
  if (fs.existsSync(seedPath)) {
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    console.log(`Importing ${seedData.length} products into catalog...`);
    const body = seedData.map(p => JSON.stringify(p)).join('\n');
    const importRes = await fetch('http://127.0.0.1:8108/collections/catalog/documents/import?action=upsert', {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': apiKey,
        'Content-Type': 'text/plain'
      },
      body
    });
    console.log('Import response status:', importRes.status);
  } else {
    console.error('Seed file not found at:', seedPath);
  }
}

// Serve single-page search UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Search API
app.get('/api/search', async (req, res) => {
  const query = req.query.q || '';

  try {
    // Generate a unique user id for every search to bypass the 4-second type-ahead pause and ensure immediate aggregation
    const uniqueUserId = `user_${Math.random().toString(36).substring(2)}_${Date.now().toString(36)}`;

    // Query Typesense catalog
    const searchUrl = `http://127.0.0.1:8108/collections/catalog/documents/search?q=${encodeURIComponent(query)}&query_by=name&x-typesense-user-id=${encodeURIComponent(uniqueUserId)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'X-TYPESENSE-API-KEY': apiKey }
    });

    if (!searchRes.ok) {
      throw new Error(`Typesense search failed with status ${searchRes.status}`);
    }

    const searchData = await searchRes.json();
    const found = searchData.found || 0;

    // Map hits
    const hits = (searchData.hits || []).map(h => ({
      id: h.document.id,
      name: h.document.name,
      category: h.document.category,
      price: h.document.price
    }));

    let suggestions = [];
    if (found === 0) {
      // Fetch popular queries from popular_queries collection
      const popularRes = await fetch(`http://127.0.0.1:8108/collections/popular_queries/documents/search?q=*&per_page=250`, {
        headers: { 'X-TYPESENSE-API-KEY': apiKey }
      });
      if (popularRes.ok) {
        const popularData = await popularRes.json();
        const popularQueries = (popularData.hits || []).map(h => ({
          q: h.document.q,
          count: h.document.count
        }));

        // Sort by count descending, then by q ascending
        popularQueries.sort((a, b) => {
          if (b.count !== a.count) {
            return b.count - a.count;
          }
          return a.q.localeCompare(b.q);
        });

        if (popularQueries.length > 0) {
          suggestions = popularQueries.slice(0, 10).map(item => item.q);
        }
      }

      // Fallback if no popular queries yet
      if (suggestions.length === 0) {
        suggestions = ['laptop', 'phone', 'camera', 'drone', 'tablet'];
      }
    }

    res.json({
      query,
      found,
      hits,
      suggestions
    });

  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Trending API
app.get('/api/trending', async (req, res) => {
  try {
    // Fetch popular queries from popular_queries collection
    const popularRes = await fetch(`http://127.0.0.1:8108/collections/popular_queries/documents/search?q=*&per_page=250`, {
      headers: { 'X-TYPESENSE-API-KEY': apiKey }
    });

    if (!popularRes.ok) {
      throw new Error(`Failed to fetch popular queries: ${popularRes.status}`);
    }

    const popularData = await popularRes.json();
    const trending = (popularData.hits || []).map(h => ({
      q: h.document.q,
      count: h.document.count
    }));

    // Sort by count descending, then by q ascending
    trending.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.q.localeCompare(b.q);
    });

    res.json({ trending });

  } catch (err) {
    console.error('Trending error:', err);
    res.json({ trending: [] });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  try {
    await initTypesense();
    console.log('Typesense initialization completed successfully.');
  } catch (err) {
    console.error('Failed to initialize Typesense:', err);
  }
});
