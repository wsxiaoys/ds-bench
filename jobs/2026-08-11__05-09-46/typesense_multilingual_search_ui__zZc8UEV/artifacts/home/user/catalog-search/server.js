const express = require('express');
const Typesense = require('typesense');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Read API key from /etc/typesense-api-key
const apiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();

// Initialize Typesense client
const typesenseClient = new Typesense.Client({
  nodes: [{
    host: '127.0.0.1',
    port: '8108',
    protocol: 'http'
  }],
  apiKey: apiKey,
  connectionTimeoutSeconds: 5
});

const COLLECTION_NAME = 'catalog';

async function initTypesense() {
  console.log('Initializing Typesense collection...');
  
  // Check if collection exists
  let exists = true;
  try {
    await typesenseClient.collections(COLLECTION_NAME).retrieve();
  } catch (err) {
    exists = false;
  }

  if (exists) {
    console.log(`Collection "${COLLECTION_NAME}" already exists. Recreating to ensure clean state...`);
    await typesenseClient.collections(COLLECTION_NAME).delete();
  }

  const schema = {
    name: COLLECTION_NAME,
    fields: [
      { name: 'id', type: 'string' },
      { name: 'name_en', type: 'string', locale: 'en', stem: true },
      { name: 'name_fr', type: 'string', locale: 'fr', stem: true },
      { name: 'name_de', type: 'string', locale: 'de', stem: true }
    ]
  };

  await typesenseClient.collections().create(schema);
  console.log('Collection created successfully.');

  // Load catalog.json
  const catalogPath = path.join(__dirname, 'data', 'catalog.json');
  const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  console.log(`Indexing ${catalogData.length} records...`);
  for (const record of catalogData) {
    await typesenseClient.collections(COLLECTION_NAME).documents().create(record);
  }
  console.log('Indexing completed successfully.');
}

// Serve HTML page
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Multilingual Catalog Search</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 40px;
            background-color: #f7f9fa;
            color: #333;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #fff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        h1 {
            margin-top: 0;
            font-size: 24px;
            text-align: center;
            color: #2c3e50;
        }
        .search-container {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        #search-input {
            flex: 1;
            padding: 10px;
            font-size: 16px;
            border: 1px solid #ccc;
            border-radius: 4px;
            outline: none;
        }
        #search-input:focus {
            border-color: #3498db;
        }
        #language-select {
            padding: 10px;
            font-size: 16px;
            border: 1px solid #ccc;
            border-radius: 4px;
            background-color: #fff;
            cursor: pointer;
        }
        #results {
            list-style-type: none;
            padding: 0;
            margin: 0;
        }
        .result-item {
            padding: 12px 15px;
            border-bottom: 1px solid #eee;
            font-size: 16px;
            transition: background-color 0.2s;
        }
        .result-item:last-child {
            border-bottom: none;
        }
        .result-item:hover {
            background-color: #f1f8ff;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Multilingual Catalog Search</h1>
        <div class="search-container">
            <select id="language-select">
                <option value="en" selected>English</option>
                <option value="fr">French</option>
                <option value="de">German</option>
            </select>
            <input id="search-input" type="text" placeholder="Search catalog..." autofocus autocomplete="off">
        </div>
        <ul id="results"></ul>
    </div>

    <script>
        const languageSelect = document.getElementById('language-select');
        const searchInput = document.getElementById('search-input');
        const resultsList = document.getElementById('results');

        async function performSearch() {
            const query = searchInput.value;
            const lang = languageSelect.value;

            if (!query.trim()) {
                resultsList.innerHTML = '';
                return;
            }

            try {
                const response = await fetch('/api/search?q=' + encodeURIComponent(query) + '&lang=' + encodeURIComponent(lang));
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
        languageSelect.addEventListener('change', performSearch);
    </script>
</body>
</html>
`);
});

// Search API Endpoint
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.json({ hits: [] });
  }

  let lang = req.query.lang || 'en';
  if (lang !== 'en' && lang !== 'fr' && lang !== 'de') {
    lang = 'en';
  }

  try {
    const searchParams = {
      q: q,
      query_by: `name_${lang}`
    };

    const searchResult = await typesenseClient.collections(COLLECTION_NAME).documents().search(searchParams);
    
    const hits = searchResult.hits.map(hit => {
      return {
        id: hit.document.id,
        name: hit.document[`name_${lang}`]
      };
    });

    return res.json({ hits });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: 'Search failed' });
  }
});

// Initialize Typesense and start server
async function start() {
  try {
    await initTypesense();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

start();
