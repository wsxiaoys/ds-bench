const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Read API key
let apiKey = 'xyz';
if (fs.existsSync('/etc/typesense-api-key')) {
  apiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
}

console.log('Using Typesense API Key:', apiKey);

// Serve Web UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Search API
app.get('/api/search', async (req, res) => {
  const q = req.query.q || '';
  console.log(`Received search query: "${q}"`);

  try {
    const url = new URL('http://127.0.0.1:8108/collections/catalog/documents/search');
    url.searchParams.append('q', q);
    url.searchParams.append('query_by', 'name');
    url.searchParams.append('per_page', '100');

    // To prevent Typesense from grouping all backend requests as a single user type-ahead session,
    // we use the client's IP or generate a unique ID per request if IP is not unique.
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    const resSearch = await fetch(url, {
      method: 'GET',
      headers: {
        'X-TYPESENSE-API-KEY': apiKey,
        'X-TYPESENSE-USER-ID': clientIp
      }
    });

    if (!resSearch.ok) {
      const errText = await resSearch.text();
      console.error('Typesense search failed:', errText);
      return res.status(500).json({ error: 'Search failed' });
    }

    const data = await resSearch.json();
    const found = data.found || 0;
    const hits = (data.hits || []).map(hit => ({
      id: hit.document.id,
      name: hit.document.name,
      category: hit.document.category,
      price: hit.document.price
    }));

    let suggestions = [];
    if (found === 0) {
      try {
        const urlPop = new URL('http://127.0.0.1:8108/collections/popular_queries/documents/search');
        urlPop.searchParams.append('q', '*');
        urlPop.searchParams.append('per_page', '100');

        const resPop = await fetch(urlPop, {
          method: 'GET',
          headers: { 'X-TYPESENSE-API-KEY': apiKey }
        });

        if (resPop.ok) {
          const dataPop = await resPop.json();
          if (dataPop.hits && dataPop.hits.length > 0) {
            const items = dataPop.hits.map(hit => ({
              q: hit.document.q,
              count: hit.document.count
            }));
            items.sort((a, b) => {
              if (b.count !== a.count) {
                return b.count - a.count;
              }
              return a.q.localeCompare(b.q);
            });
            suggestions = items.map(item => item.q);
          }
        }
      } catch (err) {
        console.error('Failed to fetch suggestions:', err);
      }

      if (suggestions.length === 0) {
        suggestions = ['Laptop', 'Phone', 'Camera', 'Tablet', 'Headphones'];
      }
    }

    res.json({
      query: q,
      found,
      hits,
      suggestions
    });
  } catch (err) {
    console.error('Error in /api/search:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Trending API
app.get('/api/trending', async (req, res) => {
  try {
    const urlPop = new URL('http://127.0.0.1:8108/collections/popular_queries/documents/search');
    urlPop.searchParams.append('q', '*');
    urlPop.searchParams.append('per_page', '100');

    const resPop = await fetch(urlPop, {
      method: 'GET',
      headers: { 'X-TYPESENSE-API-KEY': apiKey }
    });

    let trending = [];
    if (resPop.ok) {
      const dataPop = await resPop.json();
      if (dataPop.hits && dataPop.hits.length > 0) {
        trending = dataPop.hits.map(hit => ({
          q: hit.document.q,
          count: hit.document.count
        }));
        trending.sort((a, b) => {
          if (b.count !== a.count) {
            return b.count - a.count;
          }
          return a.q.localeCompare(b.q);
        });
      }
    }

    res.json({ trending });
  } catch (err) {
    console.error('Error in /api/trending:', err);
    res.json({ trending: [] });
  }
});

// Initialize Typesense and start server
async function initializeTypesense() {
  console.log('Initializing Typesense collections and rules...');

  // Create catalog collection
  const catalogSchema = {
    name: 'catalog',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'price', type: 'float' }
    ]
  };

  try {
    await fetch('http://127.0.0.1:8108/collections/catalog', {
      method: 'DELETE',
      headers: { 'X-TYPESENSE-API-KEY': apiKey }
    });
  } catch (err) {}

  let res = await fetch('http://127.0.0.1:8108/collections', {
    method: 'POST',
    headers: {
      'X-TYPESENSE-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(catalogSchema)
  });
  if (!res.ok) {
    throw new Error(`Failed to create catalog collection: ${await res.text()}`);
  }

  // Import catalog seed
  const seedPath = '/home/user/trendsearch/catalog-seed.json';
  if (fs.existsSync(seedPath)) {
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    const importRes = await fetch('http://127.0.0.1:8108/collections/catalog/documents/import?action=upsert', {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': apiKey,
        'Content-Type': 'text/plain'
      },
      body: seedData.map(doc => JSON.stringify(doc)).join('\n')
    });
    if (!importRes.ok) {
      throw new Error(`Failed to import seed catalog: ${await importRes.text()}`);
    }
    console.log(`Successfully imported ${seedData.length} documents into catalog`);
  } else {
    console.warn('Seed catalog not found at:', seedPath);
  }

  // Create popular_queries collection
  const popularQueriesSchema = {
    name: 'popular_queries',
    fields: [
      { name: 'q', type: 'string', sort: true },
      { name: 'count', type: 'int32' }
    ]
  };

  try {
    await fetch('http://127.0.0.1:8108/collections/popular_queries', {
      method: 'DELETE',
      headers: { 'X-TYPESENSE-API-KEY': apiKey }
    });
  } catch (err) {}

  res = await fetch('http://127.0.0.1:8108/collections', {
    method: 'POST',
    headers: {
      'X-TYPESENSE-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(popularQueriesSchema)
  });
  if (!res.ok) {
    throw new Error(`Failed to create popular_queries collection: ${await res.text()}`);
  }

  // Create no_hits_queries collection
  const noHitsQueriesSchema = {
    name: 'no_hits_queries',
    fields: [
      { name: 'q', type: 'string', sort: true },
      { name: 'count', type: 'int32' }
    ]
  };

  try {
    await fetch('http://127.0.0.1:8108/collections/no_hits_queries', {
      method: 'DELETE',
      headers: { 'X-TYPESENSE-API-KEY': apiKey }
    });
  } catch (err) {}

  res = await fetch('http://127.0.0.1:8108/collections', {
    method: 'POST',
    headers: {
      'X-TYPESENSE-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(noHitsQueriesSchema)
  });
  if (!res.ok) {
    throw new Error(`Failed to create no_hits_queries collection: ${await res.text()}`);
  }

  // Create popular_queries rule
  const popularRule = {
    type: 'popular_queries',
    params: {
      source: { collections: ['catalog'] },
      destination: { collection: 'popular_queries' },
      limit: 1000
    }
  };

  res = await fetch('http://127.0.0.1:8108/analytics/rules/popular_queries_rule', {
    method: 'PUT',
    headers: {
      'X-TYPESENSE-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(popularRule)
  });
  if (!res.ok) {
    throw new Error(`Failed to create popular_queries rule: ${await res.text()}`);
  }

  // Create nohits_queries rule
  const noHitsRule = {
    type: 'nohits_queries',
    params: {
      source: { collections: ['catalog'] },
      destination: { collection: 'no_hits_queries' },
      limit: 1000
    }
  };

  res = await fetch('http://127.0.0.1:8108/analytics/rules/no_hits_queries_rule', {
    method: 'PUT',
    headers: {
      'X-TYPESENSE-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(noHitsRule)
  });
  if (!res.ok) {
    throw new Error(`Failed to create no_hits_queries rule: ${await res.text()}`);
  }

  console.log('Typesense initialization completed successfully!');
}

initializeTypesense()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running at http://127.0.0.1:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  });
