const fs = require('fs');
const path = require('path');
const express = require('express');
const Typesense = require('typesense');

const app = express();
const PORT = 3000;

// Read API key
let typesenseApiKey = 'xyz';
if (fs.existsSync('/etc/typesense-api-key')) {
  typesenseApiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
}

console.log(`Using Typesense API Key: ${typesenseApiKey}`);

const typesenseClient = new Typesense.Client({
  nodes: [{
    host: '127.0.0.1',
    port: '8108',
    protocol: 'http'
  }],
  apiKey: typesenseApiKey,
  connectionTimeoutSeconds: 5
});

// Helper to get trending queries
async function getTrendingQueries() {
  try {
    const searchResults = await typesenseClient.collections('popular_queries_collection').documents().search({
      q: '*',
      per_page: 250
    });

    const trending = (searchResults.hits || []).map(hit => ({
      q: hit.document.q,
      count: hit.document.count
    }));

    // Sort by count descending, then by q ascending (A->Z)
    trending.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.q.localeCompare(b.q);
    });

    return trending;
  } catch (err) {
    console.error('Error fetching trending queries:', err);
    return [];
  }
}

// Helper to get suggestions
async function getSuggestions() {
  const trending = await getTrendingQueries();
  let suggestions = trending.map(t => t.q);
  if (suggestions.length === 0) {
    suggestions = ["Laptop", "Phone", "Camera", "Drone", "Tablet", "Keyboard", "Headphones"];
  }
  return suggestions;
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Search API
app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    const isWildcard = !q.trim();
    
    // Perform search on catalog
    const searchParams = {
      q: q.trim() || '*',
      query_by: 'name'
    };

    if (isWildcard) {
      searchParams.enable_analytics = false;
    } else {
      // Send a random user ID on every search to bypass the 4-second pause rule in Typesense
      // and ensure immediate registration for analytics.
      searchParams['x-typesense-user-id'] = Math.random().toString(36).substring(2, 15);
    }

    const searchResults = await typesenseClient.collections('catalog').documents().search(searchParams);

    const found = searchResults.found || 0;
    const hits = (searchResults.hits || []).map(hit => ({
      id: hit.document.id,
      name: hit.document.name,
      category: hit.document.category,
      price: hit.document.price
    }));

    let suggestions = [];
    if (found === 0) {
      suggestions = await getSuggestions();
    }

    res.json({
      query: q,
      found,
      hits,
      suggestions
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Trending API
app.get('/api/trending', async (req, res) => {
  try {
    const trending = await getTrendingQueries();
    res.json({ trending });
  } catch (err) {
    console.error('Trending fetch error:', err);
    res.json({ trending: [] });
  }
});

// Initialize and start server
async function start() {
  try {
    console.log('Initializing Typesense collections and rules...');
    
    // Retrieve existing collections
    const collectionsList = await typesenseClient.collections().retrieve();
    const collectionNames = collectionsList.map(c => c.name);

    // Delete existing collections if they exist
    if (collectionNames.includes('catalog')) {
      console.log('Deleting catalog collection...');
      await typesenseClient.collections('catalog').delete();
    }
    if (collectionNames.includes('popular_queries_collection')) {
      console.log('Deleting popular_queries_collection collection...');
      await typesenseClient.collections('popular_queries_collection').delete();
    }
    if (collectionNames.includes('no_hits_queries_collection')) {
      console.log('Deleting no_hits_queries_collection collection...');
      await typesenseClient.collections('no_hits_queries_collection').delete();
    }

    // Delete existing analytics rules if they exist
    try {
      await typesenseClient.analytics.rules('popular_queries_rule').delete();
      console.log('Deleted popular_queries_rule');
    } catch (err) {}
    try {
      await typesenseClient.analytics.rules('nohits_queries_rule').delete();
      console.log('Deleted nohits_queries_rule');
    } catch (err) {}

    // Recreate collections
    console.log('Creating catalog collection...');
    await typesenseClient.collections().create({
      name: 'catalog',
      fields: [
        { name: 'name', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'price', type: 'float' }
      ]
    });

    console.log('Creating popular_queries_collection...');
    await typesenseClient.collections().create({
      name: 'popular_queries_collection',
      fields: [
        { name: 'q', type: 'string' },
        { name: 'count', type: 'int32' }
      ]
    });

    console.log('Creating no_hits_queries_collection...');
    await typesenseClient.collections().create({
      name: 'no_hits_queries_collection',
      fields: [
        { name: 'q', type: 'string' },
        { name: 'count', type: 'int32' }
      ]
    });

    // Recreate rules
    console.log('Creating popular_queries_rule...');
    await typesenseClient.analytics.rules().upsert('popular_queries_rule', {
      type: 'popular_queries',
      params: {
        source: { collections: ['catalog'] },
        destination: { collection: 'popular_queries_collection' },
        limit: 1000
      }
    });

    console.log('Creating nohits_queries_rule...');
    await typesenseClient.analytics.rules().upsert('nohits_queries_rule', {
      type: 'nohits_queries',
      params: {
        source: { collections: ['catalog'] },
        destination: { collection: 'no_hits_queries_collection' },
        limit: 1000
      }
    });

    // Import seed data
    const seedPath = '/home/user/trendsearch/catalog-seed.json';
    if (fs.existsSync(seedPath)) {
      const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      console.log(`Importing ${seedData.length} products into catalog...`);
      await typesenseClient.collections('catalog').documents().import(seedData);
      console.log('Import successful.');
    } else {
      console.error(`Seed file not found at ${seedPath}`);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://127.0.0.1:${PORT}`);
    });
  } catch (err) {
    console.error('Error during initialization:', err);
    process.exit(1);
  }
}

start();
