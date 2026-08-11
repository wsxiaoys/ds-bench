const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const PORT = 3000;

const TYPESENSE_URL = 'http://127.0.0.1:8108';
const API_KEY = 'YPIDOSs6jQcrc8MBbPaaCgjNeXj0vGrZ';

// Load dataset in memory for detail view and startup indexing
const citiesDataPath = path.join(__dirname, 'data', 'cities.json');
const citiesList = JSON.parse(fs.readFileSync(citiesDataPath, 'utf8'));
const citiesMap = new Map(citiesList.map(c => [c.id, c]));

async function initTypesense() {
  console.log('Initializing Typesense...');
  const maxRetries = 10;
  let attempt = 0;
  let healthy = false;

  while (attempt < maxRetries) {
    try {
      const res = await fetch(`${TYPESENSE_URL}/health`, {
        headers: { 'X-TYPESENSE-API-KEY': API_KEY }
      });
      if (res.ok) {
        const health = await res.json();
        if (health.ok) {
          healthy = true;
          break;
        }
      }
    } catch (err) {
      // ignore and retry
    }
    attempt++;
    console.log(`Waiting for Typesense... attempt ${attempt}/${maxRetries}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (!healthy) {
    throw new Error('Typesense is not healthy or not running.');
  }

  try {
    // Delete collection if it exists
    await fetch(`${TYPESENSE_URL}/collections/cities`, {
      method: 'DELETE',
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });

    // Create collection
    const schema = {
      name: 'cities',
      fields: [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string', sort: true },
        { name: 'country', type: 'string' },
        { name: 'population', type: 'int32' }
      ],
      default_sorting_field: 'population'
    };

    const createRes = await fetch(`${TYPESENSE_URL}/collections`, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(schema)
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Failed to create collection: ${errText}`);
    }

    // Import documents
    const jsonl = citiesList.map(city => JSON.stringify(city)).join('\n');
    const importRes = await fetch(`${TYPESENSE_URL}/collections/cities/documents/import?action=upsert`, {
      method: 'POST',
      headers: {
        'X-TYPESENSE-API-KEY': API_KEY,
        'Content-Type': 'text/plain'
      },
      body: jsonl
    });

    if (!importRes.ok) {
      const errText = await importRes.text();
      throw new Error(`Failed to import cities: ${errText}`);
    }

    console.log('Typesense initialization completed successfully.');
  } catch (error) {
    console.error('Typesense initialization failed:', error);
    process.exit(1);
  }
}

function fallbackHighlight(name, query) {
  if (!query) return name;
  const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return name.replace(regex, '<mark>$1</mark>');
}

// GET / - HTML page containing search <input id="q">
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>City Search</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f8f9fa;
            margin: 0;
            padding: 50px 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        h1 {
            color: #343a40;
            margin-bottom: 30px;
        }
        .search-container {
            position: relative;
            width: 100%;
            max-width: 500px;
        }
        #q {
            width: 100%;
            box-sizing: border-box;
            padding: 12px 20px;
            font-size: 16px;
            border: 2px solid #ced4da;
            border-radius: 4px;
            outline: none;
            transition: border-color 0.15s ease-in-out;
        }
        #q:focus {
            border-color: #80bdff;
            box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
        }
        #suggestions {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            z-index: 1000;
            background-color: #fff;
            border: 1px solid #ced4da;
            border-top: none;
            border-radius: 0 0 4px 4px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            max-height: 400px;
            overflow-y: auto;
        }
        .suggestion {
            padding: 12px 20px;
            cursor: pointer;
            border-bottom: 1px solid #f1f3f5;
            color: #495057;
            font-size: 15px;
        }
        .suggestion:last-child {
            border-bottom: none;
            border-radius: 0 0 4px 4px;
        }
        .suggestion.active {
            background-color: #e9ecef;
            color: #212529;
        }
        mark {
            background-color: #fff3bf;
            color: #000;
            padding: 0 2px;
            border-radius: 2px;
        }
    </style>
</head>
<body>
    <h1>City Search</h1>
    <div class="search-container">
        <input type="text" id="q" placeholder="Search for a city..." autocomplete="off" autofocus>
        <div id="suggestions"></div>
    </div>

    <script>
        const qInput = document.getElementById('q');
        const suggestionsContainer = document.getElementById('suggestions');

        let currentSuggestions = [];
        let activeIndex = -1;

        // Debounce helper
        function debounce(func, delay) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), delay);
            };
        }

        // Clear suggestions from DOM
        function clearSuggestions() {
            suggestionsContainer.innerHTML = '';
            currentSuggestions = [];
            activeIndex = -1;
        }

        // Render suggestions to DOM
        function renderSuggestions(suggestions) {
            suggestionsContainer.innerHTML = '';
            currentSuggestions = suggestions;
            activeIndex = -1;

            if (suggestions.length === 0) {
                return;
            }

            suggestions.forEach((suggestion, index) => {
                const div = document.createElement('div');
                div.className = 'suggestion';
                div.innerHTML = suggestion.name;

                // Click event
                div.addEventListener('click', () => {
                    window.location.href = \`/item/\${suggestion.id}\`;
                });

                // Mouse hover event to synchronize active class
                div.addEventListener('mouseenter', () => {
                    activeIndex = index;
                    updateActiveSuggestion();
                });

                suggestionsContainer.appendChild(div);
            });
        }

        // Update active class on suggestion elements
        function updateActiveSuggestion() {
            const suggestionElements = suggestionsContainer.querySelectorAll('.suggestion');
            suggestionElements.forEach((el, index) => {
                if (index === activeIndex) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            });
        }

        // Fetch suggestions from backend
        async function fetchSuggestions(query) {
            if (!query || !query.trim()) {
                clearSuggestions();
                return;
            }

            try {
                const response = await fetch(\`/api/suggest?q=\${encodeURIComponent(query)}\`);
                if (response.ok) {
                    const suggestions = await response.json();
                    // Double check if the input value has changed since the request was sent
                    if (qInput.value.trim() === query.trim()) {
                        renderSuggestions(suggestions);
                    }
                }
            } catch (error) {
                console.error('Error fetching suggestions:', error);
            }
        }

        const debouncedFetch = debounce(fetchSuggestions, 150);

        // Input listener
        qInput.addEventListener('input', (e) => {
            const query = e.target.value;
            if (!query || !query.trim()) {
                clearSuggestions();
            } else {
                debouncedFetch(query);
            }
        });

        // Keyboard navigation
        qInput.addEventListener('keydown', (e) => {
            if (currentSuggestions.length === 0) {
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (activeIndex === -1) {
                    activeIndex = 0;
                } else {
                    activeIndex = (activeIndex + 1) % currentSuggestions.length;
                }
                updateActiveSuggestion();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (activeIndex === -1 || activeIndex === 0) {
                    activeIndex = currentSuggestions.length - 1;
                } else {
                    activeIndex = activeIndex - 1;
                }
                updateActiveSuggestion();
            } else if (e.key === 'Enter') {
                if (activeIndex !== -1 && currentSuggestions[activeIndex]) {
                    e.preventDefault();
                    window.location.href = \`/item/\${currentSuggestions[activeIndex].id}\`;
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                clearSuggestions();
            }
        });
    </script>
</body>
</html>
  `;
  res.send(html);
});

// GET /api/suggest?q=<query>
app.get('/api/suggest', async (req, res) => {
  const q = req.query.q;
  if (!q || !q.trim()) {
    return res.json([]);
  }

  try {
    const url = new URL(`${TYPESENSE_URL}/collections/cities/documents/search`);
    url.searchParams.set('q', q);
    url.searchParams.set('query_by', 'name');
    url.searchParams.set('prefix', 'true');
    url.searchParams.set('min_len_1typo', '1');
    url.searchParams.set('num_typos', '2');
    url.searchParams.set('per_page', '250');

    const searchRes = await fetch(url.toString(), {
      headers: { 'X-TYPESENSE-API-KEY': API_KEY }
    });

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      console.error('Typesense search failed:', errText);
      return res.status(500).json({ error: 'Search failed' });
    }

    const searchResult = await searchRes.json();
    const hits = searchResult.hits || [];

    // Sort hits: population desc, name asc
    hits.sort((a, b) => {
      const popA = a.document.population;
      const popB = b.document.population;
      if (popB !== popA) {
        return popB - popA;
      }
      return a.document.name.localeCompare(b.document.name);
    });

    // Map to exactly the required keys: id, name, country, population
    // Limit to at most 8 suggestions
    const suggestions = hits.slice(0, 8).map(hit => {
      let highlightedName = '';
      if (hit.highlight && hit.highlight.name && hit.highlight.name.snippet) {
        highlightedName = hit.highlight.name.snippet;
      } else if (hit.highlights && hit.highlights.length > 0) {
        const nameHighlight = hit.highlights.find(h => h.field === 'name');
        if (nameHighlight && nameHighlight.snippet) {
          highlightedName = nameHighlight.snippet;
        }
      }

      if (!highlightedName) {
        highlightedName = fallbackHighlight(hit.document.name, q);
      }

      return {
        id: hit.document.id,
        name: highlightedName,
        country: hit.document.country,
        population: hit.document.population
      };
    });

    res.json(suggestions);
  } catch (error) {
    console.error('Error in /api/suggest:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /item/:id
app.get('/item/:id', (req, res) => {
  const id = req.params.id;
  const city = citiesMap.get(id);
  if (!city) {
    return res.status(404).send('City not found');
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${city.name}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 40px;
            background: #f4f4f9;
            color: #333;
        }
        .container {
            background: #fff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            max-width: 500px;
            margin: 0 auto;
        }
        h1 {
            margin-top: 0;
            color: #2c3e50;
        }
        p {
            font-size: 1.1em;
            line-height: 1.6;
        }
        .label {
            font-weight: bold;
            color: #7f8c8d;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${city.name}</h1>
        <p><span class="label">Country:</span> ${city.country}</p>
        <p><span class="label">Population:</span> ${city.population.toLocaleString()}</p>
        <p><a href="/">Back to Search</a></p>
    </div>
</body>
</html>
  `;
  res.send(html);
});

initTypesense().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize Typesense:', err);
  process.exit(1);
});
