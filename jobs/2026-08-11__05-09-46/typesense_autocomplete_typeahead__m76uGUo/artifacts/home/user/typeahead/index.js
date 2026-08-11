const express = require('express');
const Typesense = require('typesense');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const app = express();
const PORT = 3000;

// Path to files
const CITIES_JSON_PATH = '/home/user/typeahead/data/cities.json';
const API_KEY_PATH = '/etc/typesense-api-key';
const TYPESENSE_DATA_DIR = '/home/user/typeahead/typesense-data';

// Read API key
let apiKey = '';
try {
  apiKey = fs.readFileSync(API_KEY_PATH, 'utf8').trim();
} catch (err) {
  console.error(`Error reading API key from ${API_KEY_PATH}:`, err.message);
  process.exit(1);
}

// In-memory map of cities for quick O(1) detail page lookups
let citiesMap = new Map();
try {
  const citiesData = JSON.parse(fs.readFileSync(CITIES_JSON_PATH, 'utf8'));
  citiesMap = new Map(citiesData.map(c => [c.id, c]));
  console.log(`Loaded ${citiesMap.size} cities from dataset.`);
} catch (err) {
  console.error(`Error loading cities dataset from ${CITIES_JSON_PATH}:`, err.message);
  process.exit(1);
}

// Initialize Typesense client
const client = new Typesense.Client({
  'nodes': [{
    'host': '127.0.0.1',
    'port': '8108',
    'protocol': 'http'
  }],
  'apiKey': apiKey,
  'connectionTimeoutSeconds': 5
});

// Helper to check if Typesense is running
function isTypesenseRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:8108/health', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

// Ensure Typesense is started and healthy
function startTypesense() {
  return new Promise(async (resolve, reject) => {
    if (await isTypesenseRunning()) {
      console.log('Typesense is already running.');
      return resolve();
    }

    console.log('Starting Typesense server...');
    fs.mkdirSync(TYPESENSE_DATA_DIR, { recursive: true });

    const child = spawn('typesense-server', [
      `--data-dir=${TYPESENSE_DATA_DIR}`,
      `--api-key=${apiKey}`
    ], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (await isTypesenseRunning()) {
        clearInterval(interval);
        console.log('Typesense server started successfully.');
        resolve();
      } else if (attempts > 30) {
        clearInterval(interval);
        reject(new Error('Failed to start Typesense server after 30 attempts.'));
      }
    }, 500);
  });
}

// Recreate collection and index documents
async function indexDataset() {
  console.log('Indexing dataset into Typesense...');
  const schema = {
    'name': 'cities',
    'fields': [
      { 'name': 'id', 'type': 'string' },
      { 'name': 'name', 'type': 'string' },
      { 'name': 'country', 'type': 'string' },
      { 'name': 'population', 'type': 'int32' }
    ],
    'default_sorting_field': 'population'
  };

  try {
    await client.collections('cities').delete();
    console.log('Deleted existing "cities" collection.');
  } catch (err) {
    // Ignore if collection doesn't exist
  }

  await client.collections().create(schema);
  console.log('Created "cities" collection.');

  const citiesData = Array.from(citiesMap.values());
  await client.collections('cities').documents().import(citiesData, { action: 'upsert' });
  console.log(`Successfully indexed ${citiesData.length} cities.`);
}

// Express App routes

// GET / - Search UI
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>City Search</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f7fafc;
      margin: 0;
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .search-container {
      position: relative;
      width: 100%;
      max-width: 500px;
    }
    #q {
      width: 100%;
      padding: 12px 16px;
      font-size: 16px;
      border: 2px solid #cbd5e0;
      border-radius: 8px;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    #q:focus {
      border-color: #3182ce;
    }
    #suggestions {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-top: none;
      border-bottom-left-radius: 8px;
      border-bottom-right-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      z-index: 10;
      margin-top: 4px;
      overflow: hidden;
    }
    .suggestion {
      padding: 12px 16px;
      cursor: pointer;
      font-size: 15px;
      color: #2d3748;
      transition: background-color 0.1s;
    }
    .suggestion:hover {
      background-color: #f7fafc;
    }
    .suggestion.active {
      background-color: #ebf8ff;
      border-left: 4px solid #3182ce;
      padding-left: 12px;
    }
    mark {
      background-color: #feebc8;
      color: #c05621;
      font-weight: bold;
      padding: 0 2px;
      border-radius: 2px;
    }
  </style>
</head>
<body>
  <div class="search-container">
    <input type="text" id="q" placeholder="Search cities..." autocomplete="off" autofocus>
    <div id="suggestions"></div>
  </div>

  <script>
    const input = document.getElementById('q');
    const suggestionsContainer = document.getElementById('suggestions');

    let suggestionsData = [];
    let activeIndex = -1;

    // Debounce helper
    function debounce(func, wait) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }

    // Clear dropdown and reset state
    function closeDropdown() {
      suggestionsContainer.innerHTML = '';
      suggestionsData = [];
      activeIndex = -1;
    }

    // Update active suggestion class in DOM
    function updateActiveSuggestion() {
      const elements = suggestionsContainer.querySelectorAll('.suggestion');
      elements.forEach((el, index) => {
        if (index === activeIndex) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });
    }

    // Render suggestions in DOM
    function renderSuggestions(data) {
      suggestionsContainer.innerHTML = '';
      suggestionsData = data;
      activeIndex = -1;

      data.forEach((suggestion, index) => {
        const div = document.createElement('div');
        div.className = 'suggestion';
        div.innerHTML = suggestion.name; // suggestion.name contains the <mark> tags
        
        div.addEventListener('click', () => {
          window.location.href = \`/item/\${suggestion.id}\`;
        });

        suggestionsContainer.appendChild(div);
      });
    }

    // Fetch matching suggestions from API
    const fetchSuggestions = debounce(async (query) => {
      const trimmed = query.trim();
      if (!trimmed) {
        closeDropdown();
        return;
      }

      try {
        const response = await fetch(\`/api/suggest?q=\${encodeURIComponent(trimmed)}\`);
        if (response.ok) {
          const data = await response.json();
          renderSuggestions(data);
        }
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      }
    }, 200);

    // Input event handler
    input.addEventListener('input', (e) => {
      const value = e.target.value;
      if (!value.trim()) {
        closeDropdown();
      } else {
        fetchSuggestions(value);
      }
    });

    // Keyboard navigation handlers
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        if (suggestionsData.length > 0) {
          e.preventDefault();
          if (activeIndex === -1) {
            activeIndex = 0;
          } else {
            activeIndex = (activeIndex + 1) % suggestionsData.length;
          }
          updateActiveSuggestion();
        }
      } else if (e.key === 'ArrowUp') {
        if (suggestionsData.length > 0) {
          e.preventDefault();
          if (activeIndex === -1) {
            activeIndex = suggestionsData.length - 1;
          } else {
            activeIndex = (activeIndex - 1 + suggestionsData.length) % suggestionsData.length;
          }
          updateActiveSuggestion();
        }
      } else if (e.key === 'Enter') {
        if (activeIndex !== -1 && suggestionsData[activeIndex]) {
          e.preventDefault();
          window.location.href = \`/item/\${suggestionsData[activeIndex].id}\`;
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown();
      }
    });
  </script>
</body>
</html>
  `);
});

// GET /api/suggest?q=<query>
app.get('/api/suggest', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || !q.trim()) {
      return res.json([]);
    }

    const searchParameters = {
      'q': q.trim(),
      'query_by': 'name',
      'prefix': 'true',
      'num_typos': 1,
      'min_len_1typo': 1,
      'per_page': 100
    };

    const searchResult = await client.collections('cities').documents().search(searchParameters);
    const hits = searchResult.hits || [];

    // Sort hits: population descending, name ascending
    hits.sort((a, b) => {
      const popA = a.document.population;
      const popB = b.document.population;
      if (popB !== popA) {
        return popB - popA;
      }
      return a.document.name.localeCompare(b.document.name);
    });

    // Map to exactly: id, name (with highlight snippet), country, population
    const suggestions = hits.slice(0, 8).map(hit => {
      const id = hit.document.id;
      const country = hit.document.country;
      const population = hit.document.population;
      const name = (hit.highlights && hit.highlights.find(h => h.field === 'name')?.snippet) || hit.document.name;
      return { id, name, country, population };
    });

    return res.json(suggestions);
  } catch (err) {
    console.error('Error in /api/suggest:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /item/:id
app.get('/item/:id', (req, res) => {
  const city = citiesMap.get(req.params.id);
  if (!city) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Not Found</title>
      </head>
      <body>
        <h1>404 Not Found</h1>
        <p>No city found with ID: ${req.params.id}</p>
      </body>
      </html>
    `);
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${city.name}</title>
    </head>
    <body>
      <h1>${city.name}</h1>
      <p>Country: ${city.country}</p>
      <p>Population: ${city.population}</p>
    </body>
    </html>
  `);
});

// Initialize and start server
async function main() {
  try {
    await startTypesense();
    await indexDataset();
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Initialization failed:', err);
    process.exit(1);
  }
}

main();
