import Typesense from 'typesense';

const client = new Typesense.Client({
  'nodes': [{
    'host': '127.0.0.1',
    'port': '8108',
    'protocol': 'http'
  }],
  'apiKey': 'SI2NdBGuI5rzDNKFgldF6GYQ622fO6pL',
  'connectionTimeoutSeconds': 2
});

async function run() {
  // Query with accent
  const r1 = await client.collections('catalog').documents().search({ q: 'café', query_by: 'name_en' });
  console.log('Query "café" (en) matched:', r1.hits.map(h => h.document.id));

  // Query without accent
  const r2 = await client.collections('catalog').documents().search({ q: 'cafe', query_by: 'name_en' });
  console.log('Query "cafe" (en) matched:', r2.hits.map(h => h.document.id));

  // Let's index a document with "cafe" (no accent) and query with "café" (with accent)
  try {
    await client.collections('catalog').documents().create({
      id: 'test_cafe',
      name_en: 'The local cafe shop',
      name_fr: 'Le café local',
      name_de: 'Das lokale Café'
    });
    console.log('Indexed test_cafe');
  } catch (e) {
    console.log('test_cafe already exists or error:', e.message);
  }

  const r3 = await client.collections('catalog').documents().search({ q: 'café', query_by: 'name_en' });
  console.log('Query "café" (en) on unaccented document matched:', r3.hits.map(h => h.document.id));

  // Clean up test_cafe
  await client.collections('catalog').documents('test_cafe').delete();
}

run();
