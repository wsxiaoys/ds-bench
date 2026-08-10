import Typesense from 'typesense';
import fs from 'fs';

const client = new Typesense.Client({
  'nodes': [{
    'host': '127.0.0.1',
    'port': '8108',
    'protocol': 'http'
  }],
  'apiKey': 'SI2NdBGuI5rzDNKFgldF6GYQ622fO6pL',
  'connectionTimeoutSeconds': 2
});

const schema = {
  'name': 'catalog',
  'fields': [
    { 'name': 'id', 'type': 'string' },
    { 'name': 'name_en', 'type': 'string', 'locale': 'en', 'stem': true },
    { 'name': 'name_fr', 'type': 'string', 'locale': 'fr', 'stem': true },
    { 'name': 'name_de', 'type': 'string', 'locale': 'de', 'stem': true }
  ]
};

async function run() {
  try {
    // Delete if exists
    try {
      await client.collections('catalog').delete();
      console.log('Deleted existing collection');
    } catch (e) {
      // ignore
    }

    // Create collection
    await client.collections().create(schema);
    console.log('Created collection');

    // Load data
    const catalog = JSON.parse(fs.readFileSync('./data/catalog.json', 'utf8'));
    for (const doc of catalog) {
      await client.collections('catalog').documents().create(doc);
    }
    console.log('Indexed documents');

    // Test search queries
    const testQueries = [
      // English tests
      { q: 'bake', lang: 'en', field: 'name_en' },
      { q: 'baking', lang: 'en', field: 'name_en' },
      { q: 'glaze', lang: 'en', field: 'name_en' },
      { q: 'glazing', lang: 'en', field: 'name_en' },
      { q: 'finish', lang: 'en', field: 'name_en' },
      { q: 'finishing', lang: 'en', field: 'name_en' },
      { q: 'carve', lang: 'en', field: 'name_en' },
      { q: 'carving', lang: 'en', field: 'name_en' },

      // French tests
      { q: 'finir', lang: 'fr', field: 'name_fr' },
      { q: 'finissons', lang: 'fr', field: 'name_fr' },
      { q: 'pain', lang: 'fr', field: 'name_fr' },
      { q: 'pains', lang: 'fr', field: 'name_fr' },

      // German tests
      { q: 'schnitzen', lang: 'de', field: 'name_de' },
      { q: 'schnitzens', lang: 'de', field: 'name_de' },
      { q: 'verfeinern', lang: 'de', field: 'name_de' },
      { q: 'verfeinert', lang: 'de', field: 'name_de' }
    ];

    for (const test of testQueries) {
      const searchParams = {
        'q': test.q,
        'query_by': test.field,
      };
      const results = await client.collections('catalog').documents().search(searchParams);
      const matchedIds = results.hits.map(h => h.document.id);
      console.log(`Query "${test.q}" (lang: ${test.lang}): matched [${matchedIds.join(', ')}]`);
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
