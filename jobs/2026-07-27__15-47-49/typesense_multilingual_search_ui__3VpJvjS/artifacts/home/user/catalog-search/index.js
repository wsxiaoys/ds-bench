const express = require("express");
const fs = require("fs");
const path = require("path");
const Typesense = require("typesense");

// --- Configuration ---
const PORT = 3000;
const HOST = "0.0.0.0";
const TYPESENSE_HOST = "127.0.0.1";
const TYPESENSE_PORT = 8108;
const TYPESENSE_PROTOCOL = "http";
const TYPESENSE_API_KEY = fs
  .readFileSync("/etc/typesense-api-key", "utf-8")
  .trim();

const COLLECTION_NAME = "catalog";
const CATALOG_PATH = path.join(__dirname, "data", "catalog.json");

// --- Typesense client ---
const typesense = new Typesense.Client({
  nodes: [
    {
      host: TYPESENSE_HOST,
      port: TYPESENSE_PORT,
      protocol: TYPESENSE_PROTOCOL,
    },
  ],
  apiKey: TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 10,
});

// --- Schema definition ---
// Each language field has stem:true and its locale for language-specific stemming.
// English locale "en" also handles accent folding (café <-> cafe).
const collectionSchema = {
  name: COLLECTION_NAME,
  fields: [
    { name: "name_en", type: "string", locale: "en", stem: true },
    { name: "name_fr", type: "string", locale: "fr", stem: true },
    { name: "name_de", type: "string", locale: "de", stem: true },
  ],
};

// --- Startup: ensure collection exists and index data ---
async function ensureCollection() {
  // Drop and recreate to ensure schema is always correct (idempotent)
  try {
    await typesense.collections(COLLECTION_NAME).delete();
    console.log(`Dropped existing collection '${COLLECTION_NAME}'.`);
  } catch (err) {
    // 404 is fine — collection doesn't exist yet
    if (err.httpStatus !== 404) {
      throw err;
    }
  }
  console.log(`Creating collection '${COLLECTION_NAME}'...`);
  await typesense.collections().create(collectionSchema);
  console.log(`Collection '${COLLECTION_NAME}' created.`);
}

async function indexCatalog() {
  const raw = fs.readFileSync(CATALOG_PATH, "utf-8");
  const records = JSON.parse(raw);

  // Upsert all records idempotently
  const importResults = await typesense
    .collections(COLLECTION_NAME)
    .documents()
    .import(records, { action: "upsert" });

  // import() can return a string if there are failures
  if (typeof importResults === "string") {
    // Parse lines to check for errors
    const lines = importResults.trim().split("\n");
    for (const line of lines) {
      const parsed = JSON.parse(line);
      if (!parsed.success) {
        console.error("Failed to index document:", parsed);
      }
    }
  }
  console.log(`Indexed ${records.length} records into '${COLLECTION_NAME}'.`);
}

// --- Express app ---
const app = express();

// Serve the search page
app.get("/", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Catalog Search</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; }
    label { display: block; margin-bottom: 8px; font-weight: 600; }
    select, input { width: 100%; padding: 8px; margin-bottom: 16px; box-sizing: border-box; font-size: 16px; }
    #results { list-style: none; padding: 0; }
    .result-item { padding: 10px; border-bottom: 1px solid #eee; }
  </style>
</head>
<body>
  <h1>Catalog Search</h1>
  <label for="language-select">Language</label>
  <select id="language-select">
    <option value="en" selected>English</option>
    <option value="fr">Français</option>
    <option value="de">Deutsch</option>
  </select>
  <label for="search-input">Search</label>
  <input id="search-input" type="text" placeholder="Type to search...">
  <ul id="results"></ul>
  <script>
    const langSelect = document.getElementById("language-select");
    const searchInput = document.getElementById("search-input");
    const resultsList = document.getElementById("results");

    let currentLang = "en";
    let currentQuery = "";

    async function doSearch() {
      const q = currentQuery;
      const lang = currentLang;
      if (!q.trim()) {
        resultsList.innerHTML = "";
        return;
      }
      try {
        const resp = await fetch("/api/search?q=" + encodeURIComponent(q) + "&lang=" + encodeURIComponent(lang));
        const data = await resp.json();
        resultsList.innerHTML = "";
        for (const hit of data.hits) {
          const li = document.createElement("li");
          li.className = "result-item";
          li.setAttribute("data-doc-id", hit.id);
          li.textContent = hit.name;
          resultsList.appendChild(li);
        }
      } catch (e) {
        console.error(e);
      }
    }

    searchInput.addEventListener("input", function() {
      currentQuery = searchInput.value;
      doSearch();
    });

    langSelect.addEventListener("change", function() {
      currentLang = langSelect.value;
      doSearch();
    });
  </script>
</body>
</html>`);
});

// Search API endpoint
app.get("/api/search", async (req, res) => {
  const q = (req.query.q || "").trim();
  let lang = (req.query.lang || "en").toLowerCase();

  // Validate lang
  if (!["en", "fr", "de"].includes(lang)) {
    lang = "en";
  }

  // Empty or whitespace-only query returns empty hits
  if (!q) {
    return res.json({ hits: [] });
  }

  try {
    const searchResult = await typesense
      .collections(COLLECTION_NAME)
      .documents()
      .search({
        q: q,
        query_by: `name_${lang}`,
        // Don't include typo tolerance that could cause false matches
        num_typos: 0,
        // Include all name fields so we can pick the right language
        include_fields: "id,name_en,name_fr,name_de",
        // Prefix matching disabled — we rely on stemming for morphological matching
        prefix: false,
      });

    const hits = (searchResult.hits || []).map((hit) => {
      // The document has all name_xx fields; pick the one for the requested language
      const doc = hit.document || {};
      return {
        id: doc.id || hit.document?.id,
        name: doc[`name_${lang}`] || "",
      };
    });

    return res.json({ hits });
  } catch (err) {
    console.error("Search error:", err);
    return res.status(500).json({ hits: [], error: "Search failed" });
  }
});

// --- Start server ---
async function start() {
  await ensureCollection();
  await indexCatalog();

  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});
