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

async function test(q, lang, field) {
  const searchParams = {
    'q': q,
    'query_by': field,
  };
  const results = await client.collections('catalog').documents().search(searchParams);
  const matchedIds = results.hits.map(h => h.document.id);
  console.log(`Query "${q}" (lang: ${lang}): matched [${matchedIds.join(', ')}]`);
}

async function run() {
  // English
  await test('sign', 'en', 'name_en');
  await test('signage', 'en', 'name_en');
  await test('paint', 'en', 'name_en');
  await test('painting', 'en', 'name_en');

  // French
  await test('émailler', 'fr', 'name_fr');
  await test('emailler', 'fr', 'name_fr');
  await test('émaillage', 'fr', 'name_fr');
  await test('emaillage', 'fr', 'name_fr');
  await test('sauce', 'fr', 'name_fr');
  await test('sauces', 'fr', 'name_fr');
  await test('sculpter', 'fr', 'name_fr');
  await test('sculpture', 'fr', 'name_fr');
  await test('peindre', 'fr', 'name_fr');
  await test('peinture', 'fr', 'name_fr');
  await test('naïf', 'fr', 'name_fr');
  await test('naif', 'fr', 'name_fr');
  await test('naïve', 'fr', 'name_fr');
  await test('naive', 'fr', 'name_fr');

  // German
  await test('schnitzen', 'de', 'name_de');
  await test('schnitzens', 'de', 'name_de');
  await test('sauce', 'de', 'name_de');
  await test('saucen', 'de', 'name_de');
  await test('grundlage', 'de', 'name_de');
  await test('grundlagen', 'de', 'name_de');
  await test('verfeinern', 'de', 'name_de');
  await test('verfeinert', 'de', 'name_de');
  await test('backen', 'de', 'name_de');
  await test('sauerteig', 'de', 'name_de');
}

run();
