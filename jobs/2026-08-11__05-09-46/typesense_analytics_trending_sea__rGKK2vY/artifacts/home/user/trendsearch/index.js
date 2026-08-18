const fs = require('fs');
const path = require('path');
const express = require('express');
const Typesense = require('typesense');

const app = express();
const port = 3000;

// Read API key
let apiKey = 'xyz';
if (fs.existsSync('/etc/typesense-api-key')) {
  apiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
}

console.log('Connecting to Typesense using API key:', apiKey);

const client = new Typesense.Client({
  nodes: [{ host: '127.0.0.1', port: 8108, protocol: 'http' }],
  apiKey: apiKey,
  connectionTimeoutSeconds: 5
});

async function initTypesense() {
  console.log('Initializing Typesense collections and rules...');
  
  // Delete existing collections if they exist
  const collectionsToReset = ['catalog', 'product_queries', 'nohits_queries'];
  for (const name of collectionsToReset) {
    try {
      await client.collections(name).delete();
      console.log(`Deleted collection: ${name}`);
    } catch (err) {
      // Ignore if doesn't exist
    }
  }

  // Create catalog collection
  const catalogSchema = {
    name: 'catalog',
    fields: [
      { name: 'name', type: 'string' },
      { name: 'category', type: 'string', facet: true },
      { name: 'price', type: 'float' }
    ]
  };
  await client.collections().create(catalogSchema);
  console.log('Created catalog collection');

  // Create product_queries collection
  const queriesSchema = {
    name: 'product_queries',
    fields: [
      { name: 'q', type: 'string' },
      { name: 'count', type: 'int32' }
    ]
  };
  await client.collections().create(queriesSchema);
  console.log('Created product_queries collection');

  // Create nohits_queries collection
  const nohitsSchema = {
    name: 'nohits_queries',
    fields: [
      { name: 'q', type: 'string' },
      { name: 'count', type: 'int32' }
    ]
  };
  await client.collections().create(nohitsSchema);
  console.log('Created nohits_queries collection');

  // Create rules
  const popularRule = {
    name: 'popular_queries_rule',
    type: 'popular_queries',
    params: {
      source: {
        collections: ['catalog']
      },
      destination: {
        collection: 'product_queries'
      },
      limit: 1000
    }
  };
  await client.analytics.rules().upsert('popular_queries_rule', popularRule);
  console.log('Created popular_queries rule');

  const nohitsRule = {
    name: 'nohits_queries_rule',
    type: 'nohits_queries',
    params: {
      source: {
        collections: ['catalog']
      },
      destination: {
        collection: 'nohits_queries'
      },
      limit: 1000
    }
  };
  await client.analytics.rules().upsert('nohits_queries_rule', nohitsRule);
  console.log('Created nohits_queries rule');

  // Index catalog seed data
  const seedPath = '/home/user/trendsearch/catalog-seed.json';
  if (fs.existsSync(seedPath)) {
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    await client.collections('catalog').documents().import(seedData, { action: 'upsert' });
    console.log(`Successfully indexed ${seedData.length} products from seed file.`);
  } else {
    console.warn(`Seed file not found at ${seedPath}`);
  }
}

// Serve single-page search UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API Search endpoint
app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    
    // Search catalog
    const searchRes = await client.collections('catalog').documents().search({
      q: q,
      query_by: 'name'
    });

    const found = searchRes.found;
    const hits = searchRes.hits.map(h => ({
      id: h.document.id,
      name: h.document.name,
      category: h.document.category,
      price: h.document.price
    }));

    let suggestions = [];
    if (found === 0) {
      // Fetch trending queries to use as suggestions
      try {
        const trendingRes = await client.collections('product_queries').documents().search({
          q: '*',
          query_by: 'q',
          per_page: 100
        });
        
        // Sort trending queries by count desc, q asc
        const trendingItems = trendingRes.hits.map(h => h.document);
        trendingItems.sort((a, b) => {
          if (b.count !== a.count) {
            return b.count - a.count;
          }
          return a.q.localeCompare(b.q);
        });

        suggestions = trendingItems.map(item => item.q);
      } catch (err) {
        console.error('Error fetching trending for suggestions:', err);
      }

      // Fallback defaults to ensure non-empty array
      const defaults = ["Laptop", "Phone", "Camera", "Drone", "Tablet"];
      for (const d of defaults) {
        if (!suggestions.includes(d.toLowerCase()) && !suggestions.includes(d)) {
          suggestions.push(d);
        }
      }
    }

    res.json({
      query: q,
      found: found,
      hits: hits,
      suggestions: suggestions
    });

  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// API Trending endpoint
app.get('/api/trending', async (req, res) => {
  try {
    const trendingRes = await client.collections('product_queries').documents().search({
      q: '*',
      query_by: 'q',
      per_page: 100
    });

    const trendingItems = trendingRes.hits.map(h => h.document);
    trendingItems.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.q.localeCompare(b.q);
    });

    const trending = trendingItems.map(item => ({
      q: item.q,
      count: item.count
    }));

    res.json({ trending });

  } catch (err) {
    console.error('Trending error:', err);
    res.json({ trending: [] });
  }
});

async function start() {
  let retries = 5;
  while (retries > 0) {
    try {
      await client.collections().retrieve();
      break;
    } catch (err) {
      console.log(`Waiting for Typesense server... (${retries} retries left)`);
      retries--;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  await initTypesense();

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

start();
