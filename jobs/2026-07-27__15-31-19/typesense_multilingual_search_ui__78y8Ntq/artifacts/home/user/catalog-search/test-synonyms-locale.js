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
    // Delete existing synonyms first to be clean
    const synListBefore = await client.collections('catalog').synonyms().retrieve();
    for (const syn of synListBefore.synonyms) {
      await client.collections('catalog').synonyms(syn.id).delete();
    }
    console.log('Cleared existing synonyms');

    // Register synonyms with locales
    await client.collections('catalog').synonyms().upsert('french-painting', {
      synonyms: ['peindre', 'peinture'],
      locale: 'fr'
    });
    console.log('Added french-painting synonym');

    await client.collections('catalog').synonyms().upsert('french-naive', {
      synonyms: ['naïf', 'naif', 'naïve', 'naive'],
      locale: 'fr'
    });
    console.log('Added french-naive synonym');

    await client.collections('catalog').synonyms().upsert('german-verfeinern', {
      synonyms: ['verfeinern', 'verfeinert', 'verfeinerte', 'verfeinerter'],
      locale: 'de'
    });
    console.log('Added german-verfeinern synonym');

    await client.collections('catalog').synonyms().upsert('german-schnitzen', {
      synonyms: ['schnitzen', 'schnitzens', 'geschnitzt'],
      locale: 'de'
    });
    console.log('Added german-schnitzen synonym');

    await client.collections('catalog').synonyms().upsert('german-volksmalerei', {
      synonyms: ['volksmalerei', 'malerei', 'volk', 'malen', 'gemalt'],
      locale: 'de'
    });
    console.log('Added german-volksmalerei synonym');

    // Test queries
    const tests = [
      { q: 'peindre', lang: 'fr', field: 'name_fr' },
      { q: 'naif', lang: 'fr', field: 'name_fr' },
      { q: 'naive', lang: 'fr', field: 'name_fr' },
      { q: 'naïf', lang: 'fr', field: 'name_fr' },
      { q: 'naïve', lang: 'fr', field: 'name_fr' },
      { q: 'verfeinert', lang: 'de', field: 'name_de' },
      { q: 'gemalt', lang: 'de', field: 'name_de' },
      { q: 'malerei', lang: 'de', field: 'name_de' }
    ];

    for (const t of tests) {
      const res = await client.collections('catalog').documents().search({ q: t.q, query_by: t.field });
      console.log(`Query "${t.q}" (${t.lang}) matched:`, res.hits.map(h => h.document.id));
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
