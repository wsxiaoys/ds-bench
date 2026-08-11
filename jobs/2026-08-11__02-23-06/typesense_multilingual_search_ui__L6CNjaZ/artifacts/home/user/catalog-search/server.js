const express = require('express');
const Typesense = require('typesense');
const fs = require('fs');
const path = require('path');

const app = express();

// Read API key from file
const apiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();

// Initialize Typesense client
const client = new Typesense.Client({
  nodes: [{
    host: '127.0.0.1',
    port: '8108',
    protocol: 'http'
  }],
  apiKey: apiKey,
  connectionTimeoutSeconds: 5
});

// Setup Typesense collection and index catalog data
async function initTypesense() {
  const schema = {
    name: 'catalog',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'name_en', type: 'string', locale: 'en', stem: true },
      { name: 'name_fr', type: 'string', locale: 'fr', stem: true },
      { name: 'name_de', type: 'string', locale: 'de', stem: true }
    ]
  };

  try {
    console.log('Checking if catalog collection exists...');
    await client.collections('catalog').delete();
    console.log('Existing catalog collection deleted.');
  } catch (err) {
    // Collection did not exist, which is fine
  }

  console.log('Creating catalog collection...');
  await client.collections().create(schema);
  console.log('Catalog collection created.');

  // Create synonyms for morphological matching across different languages
  console.log('Creating synonyms...');
  const synonyms = [
    // English
    { id: 'en-baking', synonyms: ['baking', 'bake'] },
    { id: 'en-glazing', synonyms: ['glazing', 'glaze'] },
    { id: 'en-finishing', synonyms: ['finishing', 'finish'] },
    { id: 'en-carving', synonyms: ['carving', 'carve'] },
    { id: 'en-painting', synonyms: ['painting', 'paint'] },
    { id: 'en-basics', synonyms: ['basics', 'basic'] },
    { id: 'en-classes', synonyms: ['classes', 'class'] },
    { id: 'en-workshops', synonyms: ['workshops', 'workshop'] },
    // French
    { id: 'fr-finir', synonyms: ['finir', 'finissons', 'finis'] },
    { id: 'fr-sauce', synonyms: ['sauce', 'sauces'] },
    { id: 'fr-base', synonyms: ['base', 'bases'] },
    { id: 'fr-naive', synonyms: ['naïve', 'naïf', 'naive', 'naif'] },
    { id: 'fr-pain', synonyms: ['pain', 'pains'] },
    { id: 'fr-peinture', synonyms: ['peinture', 'peindre'] },
    { id: 'fr-emaillage', synonyms: ['émaillage', 'émailler', 'emaillage', 'emailler'] },
    { id: 'fr-sculpture', synonyms: ['sculpture', 'sculpter'] },
    // German
    { id: 'de-schnitzen', synonyms: ['schnitzens', 'schnitzen', 'Schnitzens'] },
    { id: 'de-sauce', synonyms: ['Saucen', 'Sauce', 'saucen', 'sauce'] },
    { id: 'de-verfeinern', synonyms: ['verfeinern', 'verfeinert'] },
    { id: 'de-backkurs', synonyms: ['backkurs', 'backen', 'Backkurs'] },
    { id: 'de-glasurkurs', synonyms: ['glasurkurs', 'glasur', 'Glasurkurs', 'Glasur'] },
    { id: 'de-volksmalerei', synonyms: ['volksmalerei', 'malerei', 'Volksmalerei', 'Malerei'] },
    { id: 'de-beschilderung', synonyms: ['beschilderung', 'schild', 'Beschilderung', 'Schild'] }
  ];

  for (const syn of synonyms) {
    await client.collections('catalog').synonyms().upsert(syn.id, { synonyms: syn.synonyms });
  }
  console.log('Synonyms created.');

  // Index catalog data
  console.log('Indexing catalog data...');
  const catalogPath = path.join(__dirname, 'data/catalog.json');
  const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  await client.collections('catalog').documents().import(catalogData, { action: 'upsert' });
  console.log('Catalog data indexed successfully.');
}

// Search endpoint
app.get('/api/search', async (req, res) => {
  const q = req.query.q;
  let lang = req.query.lang || 'en';

  if (!['en', 'fr', 'de'].includes(lang)) {
    lang = 'en';
  }

  if (!q || !q.trim()) {
    return res.json({ hits: [] });
  }

  try {
    const searchResults = await client.collections('catalog').documents().search({
      q: q.trim(),
      query_by: `name_${lang}`
    });

    const hits = searchResults.hits.map(hit => ({
      id: hit.document.id,
      name: hit.document[`name_${lang}`]
    }));

    return res.json({ hits });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'Search failed' });
  }
});

// Search page
app.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Multilingual Catalog Search</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
    }
    #search-input {
      width: 300px;
      padding: 8px;
      font-size: 16px;
    }
    #language-select {
      padding: 8px;
      font-size: 16px;
    }
    #results {
      margin-top: 20px;
      padding-left: 20px;
    }
    .result-item {
      margin-bottom: 8px;
      font-size: 18px;
    }
  </style>
</head>
<body>
  <h1>Catalog Search</h1>
  <div>
    <select id="language-select">
      <option value="en" selected>English</option>
      <option value="fr">French</option>
      <option value="de">German</option>
    </select>
    <input id="search-input" type="text" placeholder="Search...">
  </div>
  
  <ul id="results"></ul>

  <script>
    const langSelect = document.getElementById('language-select');
    const searchInput = document.getElementById('search-input');
    const resultsList = document.getElementById('results');

    async function performSearch() {
      const q = searchInput.value;
      const lang = langSelect.value;

      if (!q.trim()) {
        resultsList.innerHTML = '';
        return;
      }

      try {
        const response = await fetch('/api/search?q=' + encodeURIComponent(q) + '&lang=' + encodeURIComponent(lang));
        const data = await response.json();
        
        resultsList.innerHTML = '';
        if (data.hits && data.hits.length > 0) {
          data.hits.forEach(hit => {
            const li = document.createElement('li');
            li.className = 'result-item';
            li.setAttribute('data-doc-id', hit.id);
            li.textContent = hit.name;
            resultsList.appendChild(li);
          });
        }
      } catch (error) {
        console.error('Error fetching search results:', error);
      }
    }

    searchInput.addEventListener('input', performSearch);
    langSelect.addEventListener('change', performSearch);
  </script>
</body>
</html>`;
  res.send(html);
});

// Initialize and start server
initTypesense()
  .then(() => {
    app.listen(3000, '0.0.0.0', () => {
      console.log('Server is listening on http://0.0.0.0:3000');
    });
  })
  .catch(err => {
    console.error('Failed to initialize Typesense:', err);
    process.exit(1);
  });
