import express from 'express';
import Typesense from 'typesense';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Read API key
const apiKey = fs.readFileSync('/etc/typesense-api-key', 'utf8').trim();

const client = new Typesense.Client({
  nodes: [
    {
      host: '127.0.0.1',
      port: '8108',
      protocol: 'http'
    }
  ],
  apiKey: apiKey,
  connectionTimeoutSeconds: 5
});

async function initializeTypesense() {
  console.log("Initializing Typesense...");
  try {
    try {
      await client.collections('cities').delete();
      console.log("Deleted existing 'cities' collection.");
    } catch (e) {
      // Ignore if it doesn't exist
    }

    await client.collections().create({
      name: 'cities',
      fields: [
        { name: 'name', type: 'string', sort: true },
        { name: 'country', type: 'string' },
        { name: 'population', type: 'int32' }
      ],
      default_sorting_field: 'population'
    });
    console.log("Created 'cities' collection.");

    const citiesDataPath = path.join(__dirname, 'data', 'cities.json');
    const cities = JSON.parse(fs.readFileSync(citiesDataPath, 'utf8'));
    console.log(`Loaded ${cities.length} cities from ${citiesDataPath}.`);

    await client.collections('cities').documents().import(cities, { action: 'create' });
    console.log("Successfully indexed all cities.");
  } catch (err) {
    console.error("Failed to initialize Typesense:", err);
    process.exit(1);
  }
}

// Serve GET /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve GET /api/suggest
app.get('/api/suggest', async (req, res) => {
  const query = req.query.q;
  if (!query || !query.trim()) {
    return res.json([]);
  }

  try {
    const searchResult = await client.collections('cities').documents().search({
      q: query.trim(),
      query_by: 'name',
      sort_by: 'population:desc,name:asc',
      per_page: 8
    });

    const suggestions = searchResult.hits.map(hit => ({
      id: hit.document.id,
      name: hit.document.name,
      country: hit.document.country,
      population: hit.document.population
    }));

    res.json(suggestions);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Serve GET /item/:id
app.get('/item/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const city = await client.collections('cities').documents(id).retrieve();
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(city.name)} - Details</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f5f7fa;
      color: #333;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: white;
      border: 1px solid #ccd0d5;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    h1 {
      margin: 0 0 12px 0;
      font-size: 28px;
    }
    p {
      margin: 8px 0;
      font-size: 16px;
      color: #555;
    }
    .back-link {
      display: inline-block;
      margin-top: 24px;
      color: #0066cc;
      text-decoration: none;
      font-weight: 500;
    }
    .back-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(city.name)}</h1>
    <p><strong>Country:</strong> ${escapeHtml(city.country)}</p>
    <p><strong>Population:</strong> ${city.population.toLocaleString()}</p>
    <a href="/" class="back-link">&larr; Back to Search</a>
  </div>
</body>
</html>`;
    res.send(html);
  } catch (err) {
    if (err.httpStatus === 404 || (err.message && err.message.includes('404'))) {
      res.status(404).send('City not found');
    } else {
      console.error("Retrieve error:", err);
      res.status(500).send('Internal server error');
    }
  }
});

async function startServer() {
  await initializeTypesense();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();
