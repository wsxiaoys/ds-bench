const path = require("path");
const fs = require("fs");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const ts = require("./typesense");

const PORT = process.env.PORT || 8080;
const DATA_DIR = path.join(__dirname, "data");
const BASELINE_PATH = path.join(DATA_DIR, "baseline.json");
const CATALOG_PATH = path.join(DATA_DIR, "catalog.json");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// In-memory store of saved searches. Keyed by id.
// Each entry: { id, name, q, category, max_price, match_count, new_count,
//               previousIds: Set<string> | undefined }
const savedSearches = new Map();

function sanitize(entry) {
  return {
    id: entry.id,
    name: entry.name,
    q: entry.q,
    category: entry.category,
    max_price: entry.max_price,
    match_count: entry.match_count,
    new_count: entry.new_count,
  };
}

async function checkSavedSearch(entry) {
  const currentIds = await ts.searchAllMatchingIds({
    q: entry.q,
    category: entry.category,
    max_price: entry.max_price,
  });

  let newCount = 0;
  if (entry.previousIds !== undefined) {
    for (const id of currentIds) {
      if (!entry.previousIds.has(id)) newCount++;
    }
  }

  entry.previousIds = currentIds;
  entry.match_count = currentIds.size;
  entry.new_count = newCount;
  return entry;
}

// ---- API routes ----

app.post("/api/saved-searches", async (req, res) => {
  const { name, q, category, max_price } = req.body || {};

  if (typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ error: "name is required" });
  }

  const entry = {
    id: uuidv4(),
    name,
    q: typeof q === "string" ? q : "",
    category: typeof category === "string" ? category : "",
    max_price:
      max_price === undefined || max_price === null || max_price === ""
        ? null
        : Number(max_price),
    match_count: null,
    new_count: null,
    previousIds: undefined,
  };

  savedSearches.set(entry.id, entry);
  res.status(201).json(sanitize(entry));
});

app.get("/api/saved-searches", (req, res) => {
  res.status(200).json(Array.from(savedSearches.values()).map(sanitize));
});

app.post("/api/saved-searches/:id/check", async (req, res) => {
  const entry = savedSearches.get(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: "saved search not found" });
  }
  try {
    await checkSavedSearch(entry);
    res.status(200).json(sanitize(entry));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.post("/api/check-all", async (req, res) => {
  try {
    const entries = Array.from(savedSearches.values());
    for (const entry of entries) {
      await checkSavedSearch(entry);
    }
    res.status(200).json(entries.map(sanitize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.post("/api/ingest", async (req, res) => {
  const { documents } = req.body || {};
  if (!Array.isArray(documents)) {
    return res.status(400).json({ error: "documents must be an array" });
  }

  try {
    const normalized = documents.map((d) => ({
      id: String(d.id),
      name: String(d.name),
      category: typeof d.category === "string" ? d.category : "",
      price: Number(d.price),
    }));
    const ingested = await ts.upsertDocuments(normalized);
    res.status(200).json({ ingested });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Convenience endpoint (not part of the required contract) so the UI can
// present the ingest catalog documents to choose from.
app.get("/api/catalog", (req, res) => {
  try {
    const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
    res.status(200).json(catalog);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

async function start() {
  await ts.ensureCollection();

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  await ts.upsertDocuments(
    baseline.map((d) => ({
      id: String(d.id),
      name: String(d.name),
      category: typeof d.category === "string" ? d.category : "",
      price: Number(d.price),
    }))
  );

  app.listen(PORT, () => {
    console.log(`Saved Search Alerts app listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start application:", err);
  process.exit(1);
});
