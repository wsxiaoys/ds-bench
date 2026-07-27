const express = require('express');
const Typesense = require('typesense');
const fs = require('fs');
const path = require('path');

// Read API key from file or default
let apiKey = 'xyz';
try {
  const keyFromFile = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();
  if (keyFromFile) apiKey = keyFromFile;
} catch (e) {
  // use default
}

const typesense = new Typesense.Client({
  nodes: [{ host: '127.0.0.1', port: '8108', protocol: 'http' }],
  apiKey: apiKey,
  connectionTimeoutSeconds: 5,
});

const COLLECTION = 'catalog';
const POPULAR_QUERIES_COLLECTION = 'popular_queries';
const NOHITS_QUERIES_COLLECTION = 'nohits_queries';
const POPULAR_RULE = 'popular_queries_rule';
const NOHITS_RULE = 'nohits_queries_rule';

async function setupCollections() {
  // Delete existing collections if they exist
  for (const name of [COLLECTION, POPULAR_QUERIES_COLLECTION, NOHITS_QUERIES_COLLECTION]) {
    try {
      await typesense.collections(name).delete();
      console.log(`Deleted collection: ${name}`);
    } catch (e) {
      // doesn't exist, fine
    }
  }

  // Create catalog collection
  await typesense.collections().create({
    name: COLLECTION,
    fields: [
      { name: 'name', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'price', type: 'float' },
    ],
  });
  console.log(`Created collection: ${COLLECTION}`);

  // Import seed data
  const seedPath = path.join(__dirname, 'catalog-seed.json');
  const products = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  await typesense.collections(COLLECTION).documents().import(products);
  console.log(`Imported ${products.length} products`);

  // Create popular queries destination collection
  await typesense.collections().create({
    name: POPULAR_QUERIES_COLLECTION,
    fields: [
      { name: 'q', type: 'string', sort: true },
      { name: 'count', type: 'int32' },
    ],
  });
  console.log(`Created collection: ${POPULAR_QUERIES_COLLECTION}`);

  // Create no-hits queries destination collection
  await typesense.collections().create({
    name: NOHITS_QUERIES_COLLECTION,
    fields: [
      { name: 'q', type: 'string', sort: true },
      { name: 'count', type: 'int32' },
    ],
  });
  console.log(`Created collection: ${NOHITS_QUERIES_COLLECTION}`);
}

async function setupAnalyticsRules() {
  // Delete existing rules
  try {
    const rules = await typesense.analytics.rules().retrieve();
    for (const rule of (rules.rules || [])) {
      try {
        await typesense.analytics.rules(rule.name).delete();
        console.log(`Deleted rule: ${rule.name}`);
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // ignore
  }

  // Create popular queries rule
  await typesense.analytics.rules().upsert(POPULAR_RULE, {
    type: 'popular_queries',
    params: {
      source: {
        collections: [COLLECTION],
      },
      destination: {
        collection: POPULAR_QUERIES_COLLECTION,
      },
      limit: 1000,
      expand_query: false,
    },
  });
  console.log(`Created rule: ${POPULAR_RULE}`);

  // Create no-hits queries rule
  await typesense.analytics.rules().upsert(NOHITS_RULE, {
    type: 'nohits_queries',
    params: {
      source: {
        collections: [COLLECTION],
      },
      destination: {
        collection: NOHITS_QUERIES_COLLECTION,
      },
      limit: 1000,
    },
  });
  console.log(`Created rule: ${NOHITS_RULE}`);
}

async function getTrendingQueries() {
  try {
    // Search the popular_queries collection sorted by count descending, then q ascending
    const result = await typesense.collections(POPULAR_QUERIES_COLLECTION).documents().search({
      q: '*',
      query_by: 'q',
      sort_by: 'count:desc,q:asc',
      per_page: 250,
    });

    return (result.hits || []).map((h) => ({
      q: h.document.q,
      count: h.document.count,
    }));
  } catch (e) {
    console.error('Error fetching trending queries:', e.message);
    return [];
  }
}

const app = express();

// Serve static HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Search API
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();

  if (!q) {
    return res.json({ query: '', found: 0, hits: [], suggestions: [] });
  }

  try {
    const searchResult = await typesense.collections(COLLECTION).documents().search({
      q: q,
      query_by: 'name',
      per_page: 250,
    });

    const found = searchResult.found || 0;
    const hits = (searchResult.hits || []).map((h) => ({
      id: h.document.id,
      name: h.document.name,
    }));

    let suggestions = [];
    if (found === 0) {
      // Get trending queries to suggest
      try {
        const trending = await getTrendingQueries();
        suggestions = trending.map((t) => t.q);
      } catch (e) {
        // ignore
      }
    }

    return res.json({
      query: q,
      found: found,
      hits: hits,
      suggestions: suggestions,
    });
  } catch (e) {
    console.error('Search error:', e.message);
    return res.json({
      query: q,
      found: 0,
      hits: [],
      suggestions: [],
    });
  }
});

// Trending API
app.get('/api/trending', async (req, res) => {
  try {
    const trending = await getTrendingQueries();
    res.json({ trending });
  } catch (e) {
    console.error('Trending error:', e.message);
    res.json({ trending: [] });
  }
});

// Start server
async function start() {
  await setupCollections();
  await setupAnalyticsRules();

  app.listen(3000, () => {
    console.log('Server running on http://127.0.0.1:3000');
  });
}

start().catch((e) => {
  console.error('Startup error:', e);
  process.exit(1);
});
