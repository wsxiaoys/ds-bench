const express = require('express');
const Typesense = require('typesense');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Initialize Typesense Client
const client = new Typesense.Client({
  nodes: [{
    host: '127.0.0.1',
    port: '8108',
    protocol: 'http'
  }],
  apiKey: '4t04nBkkOjMn2xPMt30bNVMVU2AsK5Bt',
  connectionTimeoutSeconds: 5
});

// Function to initialize collection and index data
async function initTypesense() {
  const maxRetries = 15;
  const retryDelay = 1000;
  let healthy = false;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const health = await client.health.retrieve();
      if (health.ok) {
        healthy = true;
        console.log('Typesense is healthy and ready!');
        break;
      }
    } catch (e) {
      console.log(`Waiting for Typesense server... (attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  if (!healthy) {
    console.error('Could not connect to Typesense server. Exiting.');
    process.exit(1);
  }

  try {
    // Delete existing cities collection if it exists
    try {
      await client.collections('cities').delete();
      console.log('Deleted existing cities collection.');
    } catch (e) {
      // Ignore if not found
    }

    // Create cities collection schema
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

    await client.collections().create(schema);
    console.log('Created cities collection schema.');

    // Load city dataset
    const citiesPath = path.join(__dirname, 'data', 'cities.json');
    if (!fs.existsSync(citiesPath)) {
      console.error(`Cities dataset not found at ${citiesPath}`);
      process.exit(1);
    }

    const cities = JSON.parse(fs.readFileSync(citiesPath, 'utf8'));
    console.log(`Loaded ${cities.length} cities from dataset.`);

    // Import documents into Typesense
    await client.collections('cities').documents().import(cities, { action: 'create' });
    console.log('Successfully indexed cities dataset into Typesense.');

  } catch (error) {
    console.error('Failed to initialize and index Typesense:', error);
    process.exit(1);
  }
}

// GET / - Search Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// GET /api/suggest?q=<query>
app.get('/api/suggest', async (req, res) => {
  const q = req.query.q;
  if (!q || !q.trim()) {
    return res.json([]);
  }

  try {
    const searchParams = {
      q: q.trim(),
      query_by: 'name',
      sort_by: 'population:desc,name:asc',
      prefix: true,
      per_page: 8
    };

    const results = await client.collections('cities').documents().search(searchParams);

    // Map the results to exactly the required keys
    const suggestions = results.hits.map(hit => ({
      id: hit.document.id,
      name: hit.document.name,
      country: hit.document.country,
      population: hit.document.population
    }));

    // In-memory sorting as a fallback to guarantee perfect order
    suggestions.sort((a, b) => {
      if (b.population !== a.population) {
        return b.population - a.population;
      }
      return a.name.localeCompare(b.name);
    });

    // Limit to at most 8 suggestions
    const limitedSuggestions = suggestions.slice(0, 8);

    res.json(limitedSuggestions);
  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /item/:id - Detail Page
app.get('/item/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const document = await client.collections('cities').documents(id).retrieve();

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${document.name} - City Details</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 0 20px;
      line-height: 1.6;
      color: #333;
    }
    .card {
      background: #f9f9f9;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    }
    h1 {
      margin-top: 0;
      color: #111;
    }
    .meta {
      font-size: 1.1em;
      margin: 8px 0;
    }
    .label {
      font-weight: bold;
      color: #666;
    }
    .back-link {
      display: inline-block;
      margin-top: 20px;
      color: #3b82f6;
      text-decoration: none;
    }
    .back-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1 id="city-name">${document.name}</h1>
    <div class="meta"><span class="label">Country:</span> <span id="city-country">${document.country}</span></div>
    <div class="meta"><span class="label">Population:</span> <span id="city-population">${document.population}</span></div>
    <a href="/" class="back-link">&larr; Back to Search</a>
  </div>
</body>
</html>
    `);
  } catch (error) {
    if (error.status === 404 || error.httpStatus === 404) {
      return res.status(404).send('City not found');
    }
    console.error('Retrieve API error:', error);
    res.status(500).send('Internal server error');
  }
});

// Start server after initializing Typesense
async function startServer() {
  await initTypesense();
  app.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
  });
}

startServer();
