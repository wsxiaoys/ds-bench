import express from 'express';
import Typesense from 'typesense';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Read Typesense API Key
const apiKeyPath = '/etc/typesense-api-key';
let apiKey = 'SI2NdBGuI5rzDNKFgldF6GYQ622fO6pL'; // fallback default
try {
  if (fs.existsSync(apiKeyPath)) {
    apiKey = fs.readFileSync(apiKeyPath, 'utf8').trim();
    console.log('Read API key from /etc/typesense-api-key');
  }
} catch (err) {
  console.error('Error reading API key file:', err);
}

// Initialize Typesense Client
const typesenseClient = new Typesense.Client({
  'nodes': [{
    'host': '127.0.0.1',
    'port': '8108',
    'protocol': 'http'
  }],
  'apiKey': apiKey,
  'connectionTimeoutSeconds': 5
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Search Endpoint
app.get('/api/search', async (req, res) => {
  const q = req.query.q || '';
  const lang = req.query.lang || 'en';

  // Validate language, fallback to 'en'
  const validLangs = ['en', 'fr', 'de'];
  const targetLang = validLangs.includes(lang) ? lang : 'en';

  // If query is empty or whitespace-only, return empty hits
  if (!q || !q.trim()) {
    return res.json({ hits: [] });
  }

  try {
    const searchParams = {
      'q': q,
      'query_by': `name_${targetLang}`,
      'num_typos': 0, // Prevent unrelated words from matching via typo tolerance
      'prefix': 'true' // Allow prefix matching for autocomplete / search-as-you-type
    };

    const searchResults = await typesenseClient
      .collections('catalog')
      .documents()
      .search(searchParams);

    const hits = searchResults.hits.map(hit => ({
      id: hit.document.id,
      name: hit.document[`name_${targetLang}`]
    }));

    return res.json({ hits });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'Search failed' });
  }
});

// Startup Indexing function
async function initTypesense() {
  try {
    console.log('Initializing Typesense collection and indexing...');

    // Delete existing collection if it exists to ensure clean state
    try {
      await typesenseClient.collections('catalog').delete();
      console.log('Deleted existing catalog collection.');
    } catch (e) {
      // ignore
    }

    // Create collection schema with language locales and stemming enabled
    const schema = {
      'name': 'catalog',
      'fields': [
        { 'name': 'id', 'type': 'string' },
        { 'name': 'name_en', 'type': 'string', 'locale': 'en', 'stem': true },
        { 'name': 'name_fr', 'type': 'string', 'locale': 'fr', 'stem': true },
        { 'name': 'name_de', 'type': 'string', 'locale': 'de', 'stem': true }
      ]
    };

    await typesenseClient.collections().create(schema);
    console.log('Created catalog collection schema.');

    // Register synonyms with corresponding locales to handle complex morphological matching
    // French Synonyms
    await typesenseClient.collections('catalog').synonyms().upsert('french-painting', {
      synonyms: ['peindre', 'peinture'],
      locale: 'fr'
    });
    await typesenseClient.collections('catalog').synonyms().upsert('french-naive', {
      synonyms: ['naïf', 'naif', 'naïve', 'naive'],
      locale: 'fr'
    });

    // German Synonyms
    await typesenseClient.collections('catalog').synonyms().upsert('german-verfeinern', {
      synonyms: ['verfeinern', 'verfeinert', 'verfeinerte', 'verfeinerter'],
      locale: 'de'
    });
    await typesenseClient.collections('catalog').synonyms().upsert('german-schnitzen', {
      synonyms: ['schnitzen', 'schnitzens', 'geschnitzt'],
      locale: 'de'
    });
    await typesenseClient.collections('catalog').synonyms().upsert('german-volksmalerei', {
      synonyms: ['volksmalerei', 'malerei', 'volk', 'malen', 'gemalt'],
      locale: 'de'
    });

    console.log('Registered language-specific synonyms.');

    // Load and index catalog data
    const catalogPath = path.join(__dirname, 'data', 'catalog.json');
    if (fs.existsSync(catalogPath)) {
      const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      for (const doc of catalogData) {
        await typesenseClient.collections('catalog').documents().upsert(doc);
      }
      console.log(`Successfully indexed ${catalogData.length} documents.`);
    } else {
      console.error(`Catalog data file not found at: ${catalogPath}`);
    }

  } catch (err) {
    console.error('Initialization error:', err);
    process.exit(1);
  }
}

// Start HTTP Server after initializing Typesense
initTypesense().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is listening on http://0.0.0.0:${PORT}`);
  });
});
