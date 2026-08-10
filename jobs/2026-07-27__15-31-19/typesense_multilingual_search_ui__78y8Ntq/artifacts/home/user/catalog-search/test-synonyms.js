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
  try {
    // Let's add some synonyms
    await client.collections('catalog').synonyms().upsert('french-painting', {
      synonyms: ['peindre', 'peinture']
    });
    console.log('Added french-painting synonym');

    await client.collections('catalog').synonyms().upsert('french-naive', {
      synonyms: ['naïf', 'naif', 'naïve', 'naive']
    });
    console.log('Added french-naive synonym');

    await client.collections('catalog').synonyms().upsert('german-verfeinern', {
      synonyms: ['verfeinern', 'verfeinert', 'verfeinerte', 'verfeinerter']
    });
    console.log('Added german-verfeinern synonym');

    await client.collections('catalog').synonyms().upsert('german-schnitzen', {
      synonyms: ['schnitzen', 'schnitzens', 'geschnitzt']
    });
    console.log('Added german-schnitzen synonym');

    await client.collections('catalog').synonyms().upsert('german-volksmalerei', {
      synonyms: ['volksmalerei', 'malerei', 'volk', 'malen', 'gemalt']
    });
    console.log('Added german-volksmalerei synonym');

    const synList = await client.collections('catalog').synonyms().retrieve();
    console.log('Registered synonyms:', JSON.stringify(synList, null, 2));

    // Test queries
    const r1 = await client.collections('catalog').documents().search({ q: 'peindre', query_by: 'name_fr' });
    console.log('Query "peindre" matched:', r1.hits.map(h => h.document.id));

    const r2 = await client.collections('catalog').documents().search({ q: 'naif', query_by: 'name_fr' });
    console.log('Query "naif" matched:', r2.hits.map(h => h.document.id));

    const r3 = await client.collections('catalog').documents().search({ q: 'verfeinert', query_by: 'name_de' });
    console.log('Query "verfeinert" matched:', r3.hits.map(h => h.document.id));

    const r4 = await client.collections('catalog').documents().search({ q: 'gemalt', query_by: 'name_de' });
    console.log('Query "gemalt" matched:', r4.hits.map(h => h.document.id));

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
